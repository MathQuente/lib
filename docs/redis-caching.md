# Redis para cache

Este documento explica por que faz sentido adicionar Redis a este projeto e o que precisa ser feito para implementá-lo. É um guia de referência — não contém código, apenas o raciocínio e o passo a passo.

## Situação atual

Hoje a API (Fastify + Prisma + PostgreSQL) não tem nenhuma camada de cache real.

A tabela `games_cache` (Postgres) pode parecer um cache, mas não é: é um espelho manual dos dados da IGDB, populado por scripts (`sync-igdb.ts`, `backfill-*.ts`) executados sob demanda. Não tem TTL, não expira e não se atualiza sozinha — só é usada pelo endpoint de listagem/busca de jogos (`findAllGames`).

Na prática, isso significa que os seguintes métodos de `GameService` batem direto na API externa da IGDB **a cada request**, sem nenhum cache:

- `findGameById`
- `findFeaturedGames`
- `findComingSoonGames`
- `findSimilarGames`
- `findTrendingGames`
- `findMostRatedGames`

Também não existem hoje: cache em memória (Map/LRU), cache HTTP (Cache-Control/ETag), blacklist de JWT para revogar tokens antes da expiração, ou rate limiting.

## Por que Redis

1. **Menos chamadas à IGDB e menos latência.** Cada request repetida a `findGameById`, `findSimilarGames`, etc. hoje depende da latência da IGDB e conta contra o rate limit deles. Dados de jogo mudam pouco (nome, capa, gêneros, plataformas), então um cache com TTL de 10–30 minutos elimina a maior parte dessas chamadas repetidas.

2. **Compartilhado entre instâncias.** Um cache em memória (um `Map` no processo Node, por exemplo) só existe naquela instância. O Redis é externo ao processo, então se a API algum dia rodar em mais de uma instância, todas compartilham o mesmo cache — algo que um cache local não permite.

3. **Expira sozinho.** Ao contrário da tabela `games_cache`, que só é atualizada rodando um script manualmente, chaves no Redis expiram automaticamente (TTL nativo), sem precisar de cron nem de backfill.

4. **Estruturas de dados além de key-value.** Redis não é só "guardar e ler valor": tem estruturas específicas para casos como contadores com expiração (bom para rate limiting) e conjuntos ordenados (bom para rankings tipo "mais avaliados" ou "em alta"), que hoje são recalculados via query no Postgres a cada request.

5. **Revogação de sessão/JWT.** Hoje a autenticação (`@fastify/jwt`) não tem mecanismo de logout/revogação antes do token expirar naturalmente. Guardar tokens revogados no Redis (com TTL igual ao tempo restante do token) resolve isso sem precisar consultar o Postgres em todo request autenticado.

6. **Rate limiting compartilhado.** Um contador por usuário/IP com expiração por janela de tempo permite throttling de requests, e funciona corretamente mesmo com múltiplas instâncias da API — diferente de um contador em memória, que "zera" e diverge entre instâncias.

## O que precisa ser feito

### 1. Infraestrutura
- Adicionar um serviço Redis ao `docker-compose.yml`, ao lado do serviço `postgres` já existente.
- Definir uma variável de ambiente para a URL de conexão (ex.: `REDIS_URL`), seguindo o mesmo padrão das outras variáveis de ambiente do projeto.
- Decidir se o Redis precisa de volume persistente. Para cache puro (que pode ser reconstruído a qualquer momento), normalmente não precisa persistir em disco.

### 2. Cliente de conexão
- Escolher uma biblioteca cliente de Redis para Node/TypeScript (a opção mais usada e completa no ecossistema é `ioredis`).
- Criar um ponto único de conexão (client singleton), seguindo o mesmo padrão já usado para o `PrismaClient` no projeto — ou seja, uma única instância reaproveitada em toda a aplicação, não uma conexão nova a cada uso.

### 3. Camada de cache
- Criar uma camada própria de acesso ao cache (um serviço ou repositório dedicado), com operações genéricas de "ler", "gravar com tempo de expiração" e "remover" — seguindo o mesmo padrão de service/repository já usado no restante do projeto.
- Nos métodos do `GameService` que hoje chamam a IGDB diretamente, aplicar o padrão **cache-aside**: antes de chamar a IGDB, tentar buscar no cache; se não encontrar, buscar na IGDB e gravar o resultado no cache; se encontrar, retornar direto do cache sem chamar a IGDB.
- Definir uma convenção de nomes de chave por tipo de dado (ex.: um prefixo para "jogo por id", outro para "jogos similares", outro para "em breve"), para facilitar limpeza/invalidação em lote no futuro, se necessário.
- Definir tempos de expiração diferentes por tipo de dado: dados de um jogo específico (que mudam raramente) podem ter TTL mais longo; listas que dependem de dados internos do site (avaliações, trending) devem ter TTL mais curto, já que esses dados mudam com mais frequência.

### 4. Sessão / revogação de JWT (opcional, mas recomendado)
- No fluxo de logout (ou de revogação manual de um token), gravar uma marca de "token revogado" no Redis, com tempo de expiração igual ao tempo restante de validade do token.
- No ponto onde o token é validado hoje (middleware/hook de autenticação), checar se o token está marcado como revogado antes de aceitar a requisição.

### 5. Rate limiting (opcional)
- Avaliar usar um plugin de rate limiting já existente no ecossistema Fastify que suporte Redis como armazenamento, em vez de implementar a lógica de contagem manualmente — evita reinventar algo que já existe e testado.
- Se for implementar manualmente: um contador por usuário/IP, incrementado a cada request, com expiração automática ao final da janela de tempo (ex.: 1 minuto).

## O que evitar

- Não usar Redis como fonte de verdade para dados que precisam ser duráveis (avaliações, usuários, etc.) — isso continua no Postgres. Redis aqui serve só para dado efêmero/derivado, que pode ser perdido e reconstruído sem problema.
- Não tentar substituir a tabela `games_cache` pelo Redis — ela serve outro propósito (uma cópia completa e pesquisável dos dados da IGDB, usada para listagem/busca/ordenação no Postgres). O Redis complementa isso, cobrindo as chamadas diretas à IGDB que hoje não passam por essa tabela.

## Como validar depois de implementado

- Subir o ambiente com o novo serviço Redis e confirmar que a aplicação conecta a ele sem erros na inicialização.
- Fazer duas requisições seguidas a um endpoint que hoje bate na IGDB (ex.: buscar um jogo por id) e confirmar que a segunda não gera uma nova chamada à IGDB (dá para observar isso monitorando o tráfego do Redis com as ferramentas de linha de comando dele).
- Confirmar que uma chave expira sozinha após o tempo definido.
- Se implementar revogação de JWT: fazer logout e confirmar que o token antigo passa a ser rejeitado.
- Se implementar rate limiting: ultrapassar o limite propositalmente e confirmar que a API passa a rejeitar novas requisições até a janela de tempo resetar.
