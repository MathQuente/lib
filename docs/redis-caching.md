# Redis para cache

Este documento explica por que faz sentido adicionar Redis a este projeto e o que precisa ser feito para implementá-lo. É um guia de referência — não contém código, apenas o raciocínio e o passo a passo.

## Situação atual

Hoje a API (Fastify + Prisma + PostgreSQL) não tem nenhuma camada de cache de dados de jogo.

A tabela `games_cache` (Postgres) pode parecer um cache, mas não é: é um espelho manual dos dados da IGDB, populado por scripts (`sync-igdb.ts`, `backfill-*.ts`) executados sob demanda. Não tem TTL, não expira e não se atualiza sozinha — só é usada pelo endpoint de listagem/busca de jogos (`findAllGames`).

Na prática, isso significa que os seguintes métodos de `GameService` batem direto na API externa da IGDB **a cada request**, sem nenhum cache:

- `findGameById`
- `findFeaturedGames`
- `findComingSoonGames`
- `findSimilarGames`
- `findTrendingGames`
- `findMostRatedGames`

Vale notar que já existem dois usos pontuais de cache em memória no projeto, mas nenhum deles cacheia dado de jogo:

- `IGDBService.getAccessToken()` guarda o token OAuth da própria IGDB em memória, com expiração, e só busca um novo quando o atual vence.
- O fluxo de OAuth (Google/Discord) guarda states de CSRF num `Map` em memória, com limpeza periódica.

Também não existem hoje: cache HTTP (Cache-Control/ETag), blacklist de access token para revogar antes da expiração, ou rate limiting.

## Por que Redis

1. **Menos chamadas à IGDB e menos latência.** Cada request repetida a `findGameById`, `findSimilarGames`, etc. hoje depende da latência da IGDB e reduz a margem antes de esbarrar em algum limite de taxa deles (não há um número de rate limit documentado no projeto, mas é um risco real ao bater na API externa a cada request). Dados de jogo mudam pouco (nome, capa, gêneros, plataformas), então um cache com TTL elimina a maior parte dessas chamadas repetidas.

2. **Compartilhado entre instâncias.** Um cache em memória (como o que já existe para o token da IGDB) só existe naquela instância do processo. O Redis é externo ao processo, então se a API algum dia rodar em mais de uma instância, todas compartilham o mesmo cache — algo que um cache local não permite.

3. **Expira sozinho.** Ao contrário da tabela `games_cache`, que só é atualizada rodando um script manualmente, chaves no Redis expiram automaticamente (TTL nativo), sem precisar de cron nem de backfill.

4. **Estruturas de dados além de key-value.** Redis não é só "guardar e ler valor": tem estruturas específicas para casos como contadores com expiração (bom para rate limiting) e conjuntos ordenados (bom para os rankings de "trending" e "mais avaliados", que hoje são recalculados via `groupBy` no Postgres a cada request).

5. **Revogação do access token.** A autenticação (`@fastify/jwt`) já tem logout e revogação de sessão: `POST /auth/logout` invalida o refresh token no Postgres (`RefreshToken.isValid = false`), e o refresh subsequente é validado contra essa tabela. O que falta é mais específico: o access token (validade de 15 minutos) é checado só por assinatura local (`jwtVerify`), sem consultar nenhuma lista de revogação — então, entre o logout e a expiração natural, um access token já emitido continua sendo aceito. Guardar esse token como revogado no Redis (com TTL igual ao tempo restante até a expiração) fecha essa janela sem precisar consultar o Postgres em todo request autenticado.

6. **Rate limiting compartilhado.** Um contador por usuário/IP com expiração por janela de tempo permite throttling de requests, e funciona corretamente mesmo com múltiplas instâncias da API — diferente de um contador em memória, que "zera" e diverge entre instâncias.

## O que precisa ser feito

### 1. Infraestrutura
- Adicionar um serviço Redis ao `docker-compose.yml`, seguindo o mesmo estilo já usado pelo serviço `postgres` existente: nome de container explícito, `restart: always`, porta mapeada.
- Definir uma variável de ambiente para a URL de conexão (`REDIS_URL`), seguindo o padrão `SCREAMING_SNAKE_CASE` já usado pelas outras variáveis do projeto (`DATABASE_URL`, `IGDB_CLIENT_ID`, etc.).
- Volume persistente é dispensável aqui: é cache puro, pode ser reconstruído a qualquer momento sem persistir em disco.

### 2. Cliente de conexão
- Escolher uma biblioteca cliente de Redis para Node/TypeScript (a opção mais usada e completa no ecossistema é `ioredis`).
- Criar um ponto único de conexão (client singleton), espelhando o padrão já usado para o `PrismaClient` no projeto (um único módulo que instancia e exporta o client, reaproveitado por toda a aplicação, sem reconectar a cada uso).

### 3. Camada de cache
- Criar uma camada própria de acesso ao cache (um serviço ou repositório dedicado), com operações genéricas de "ler", "gravar com tempo de expiração" e "remover" — seguindo o mesmo padrão de service/repository já usado no restante do projeto.
- Nos métodos do `GameService` que hoje chamam a IGDB diretamente, aplicar o padrão **cache-aside**: antes de chamar a IGDB, tentar buscar no cache; se não encontrar, buscar na IGDB e gravar o resultado no cache; se encontrar, retornar direto do cache sem chamar a IGDB.
- Convenção de chave por tipo de dado, usando os parâmetros que já afetam cada resultado:
  - jogo por id e jogos similares: uma chave por `igdbId` (prefixos distintos para cada caso, ex. um para "jogo" e outro para "similares" do mesmo id).
  - "em breve": chave incluindo `limit` e o índice de página, já que a paginação muda o conteúdo retornado.
  - "trending" e "mais avaliados": **sem cache próprio no nível do método**. O ranking (quais ids aparecem e em que ordem) depende de atividade interna do site — jogos jogados recentemente, médias de avaliação — e uma defasagem de minutos nessa ordem não é aceitável; por isso ele continua sendo recalculado no Postgres a cada request, sem TTL nenhum, exatamente como hoje. O que entra no cache é só a busca de metadados na IGDB para os ids que saem desse ranking, dentro do helper privado `findReleasedGamesByRankedIds` — em cache-aside por `igdbId` individual (não em lote), já que o conjunto de ids muda a cada recálculo e cachear o lote inteiro perderia hits de ids que já estavam cacheados de uma chamada anterior. Usa um prefixo de chave próprio, diferente do cache de "jogo por id" (`findGameById`): a busca em lote (`IGDBService.getGamesByIds`) retorna um conjunto de campos mais restrito que a busca individual (sem `involved_companies`/`similar_games`), então compartilhar a mesma chave faria `findGameById` eventualmente ler de volta uma versão incompleta gravada por esse outro caminho.
  - "destaques" (`findFeaturedGames`): não precisa de cache próprio se os métodos que ele agrega já estiverem cacheados individualmente — evita guardar o mesmo dado duas vezes.
- TTL diferente por volatilidade real do dado:
  - dados que vêm só da IGDB e mudam raramente (jogo por id, similares, em breve, e o cache por-id de metadados usado dentro de "trending"/"mais avaliados"): TTL mais longo, da ordem de dezenas de minutos a poucas horas — a volatilidade aqui é a do dado de jogo em si, não a de quem está no ranking.
  - "trending" e "mais avaliados" em si (o ranking de ids) não têm TTL porque não são cacheados — ver bullet de convenção de chave acima.
- Sorted sets para ranking é uma otimização a avaliar depois, não um pré-requisito: mesmo com o cache por-id de metadados já decidido acima, o *ranking de ids* continua recalculado no Postgres a cada request, sem cache. Um sorted set no Redis seria uma forma de cachear esse ranking sem reintroduzir a defasagem de um TTL fixo — atualizando-o de forma incremental a cada nova avaliação/atividade, em vez de expirar por tempo —, mas é complexidade adicional real. Só vale considerar se o recálculo da agregação no Postgres se mostrar de fato um gargalo na prática; começar cacheando só a chamada à IGDB já resolve a maior parte do problema.

### 4. Revogação de access token (opcional, mas recomendado)
- No fluxo de logout, além da invalidação já existente do refresh token no Postgres, gravar uma marca de "access token revogado" no Redis, com tempo de expiração igual ao tempo restante de validade do token (no máximo 15 minutos, já que é o tempo de vida do access token).
- No decorator de autenticação (`src/jwt.ts`), depois de validar a assinatura, checar se o token está marcado como revogado antes de aceitar a requisição.
- O refresh token não precisa dessa mudança — sua revogação já é resolvida no Postgres hoje.

### 5. Rate limiting (opcional)
- Avaliar usar um plugin de rate limiting já existente no ecossistema Fastify que suporte Redis como armazenamento, em vez de implementar a lógica de contagem manualmente — evita reinventar algo que já existe e testado.
- Se for implementar manualmente: um contador por usuário/IP, incrementado a cada request, com expiração automática ao final da janela de tempo (ex.: 1 minuto).

## O que evitar

- Não usar Redis como fonte de verdade para dados que precisam ser duráveis (avaliações, usuários, etc.) — isso continua no Postgres. Redis aqui serve só para dado efêmero/derivado, que pode ser perdido e reconstruído sem problema.
- Não tentar substituir a tabela `games_cache` pelo Redis — ela serve outro propósito (uma cópia completa e pesquisável dos dados da IGDB, usada para listagem/busca/ordenação no Postgres). O Redis complementa isso, cobrindo as chamadas diretas à IGDB que hoje não passam por essa tabela.
- Não tentar cachear os fluxos de troca de `code` por token do OAuth (Google, Discord, IGDB/Twitch): o `code` é de uso único por natureza, não há o que cachear nesse passo.
- Não implementar o ranking em sorted set como primeira etapa — só considerar depois de cachear as chamadas diretas à IGDB, e só se o recálculo da agregação no Postgres se mostrar de fato um gargalo na prática.

## Como validar depois de implementado

- Subir o ambiente com o novo serviço Redis e confirmar que a aplicação conecta a ele sem erros na inicialização.
- Fazer duas requisições seguidas a um endpoint que hoje bate na IGDB (ex.: buscar um jogo por id) e confirmar que a segunda não gera uma nova chamada à IGDB (dá para observar isso monitorando o tráfego do Redis com as ferramentas de linha de comando dele).
- Confirmar que uma chave expira sozinha após o tempo definido.
- Confirmar que "trending"/"mais avaliados" refletem uma nova avaliação imediatamente (sem esperar TTL nenhum), já que o ranking em si não é cacheado — só a busca de metadados de cada jogo que aparece nele.
- Se implementar revogação de access token: fazer logout e, ainda dentro da janela de 15 minutos de validade do access token antigo, tentar usar esse token e confirmar que passa a ser rejeitado (diferente de hoje, em que ele continuaria válido até expirar naturalmente).
- Se implementar rate limiting: ultrapassar o limite propositalmente e confirmar que a API passa a rejeitar novas requisições até a janela de tempo resetar.
