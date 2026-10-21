export const FIRST_NAMES = [
  'Ana', 'Beatriz', 'Bruno', 'Camila', 'Carlos', 'Clara', 'Daniel', 'Diego',
  'Eduarda', 'Felipe', 'Fernanda', 'Gabriel', 'Gabriela', 'Gustavo', 'Helena',
  'Henrique', 'Igor', 'Isabela', 'Joana', 'João', 'Julia', 'Larissa', 'Laura',
  'Leandro', 'Letícia', 'Lucas', 'Luiza', 'Marcelo', 'Marina', 'Mateus',
  'Mariana', 'Natália', 'Nicolas', 'Otávio', 'Paula', 'Pedro', 'Rafael',
  'Raquel', 'Renato', 'Rodrigo', 'Sabrina', 'Samuel', 'Sofia', 'Tainá',
  'Thiago', 'Valentina', 'Vinícius', 'Vitória', 'Yasmin', 'Caio', 'Débora',
  'Elias', 'Fábio', 'Giovana', 'Heitor', 'Ícaro', 'Jéssica', 'Kauã', 'Lívia',
  'Murilo', 'Nathalia', 'Orlando', 'Patrícia', 'Queila', 'Ricardo', 'Simone',
  'Tales', 'Úrsula', 'Vanessa', 'Wesley'
] as const

export const LAST_NAMES = [
  'Almeida', 'Andrade', 'Araújo', 'Barbosa', 'Barros', 'Batista', 'Borges',
  'Campos', 'Cardoso', 'Carvalho', 'Castro', 'Costa', 'Dias', 'Duarte',
  'Ferraz', 'Ferreira', 'Freitas', 'Gomes', 'Guimarães', 'Lacerda', 'Leite',
  'Lima', 'Lopes', 'Machado', 'Martins', 'Medeiros', 'Mendes', 'Moraes',
  'Moreira', 'Moura', 'Nascimento', 'Nogueira', 'Nunes', 'Oliveira',
  'Pacheco', 'Pereira', 'Pinto', 'Prado', 'Ramos', 'Ribeiro', 'Rocha',
  'Rodrigues', 'Santana', 'Santos', 'Silva', 'Siqueira', 'Soares', 'Souza',
  'Tavares', 'Teixeira', 'Vasconcelos', 'Vieira', 'Xavier', 'Zanetti',
  'Albuquerque', 'Bezerra', 'Cavalcante', 'Menezes', 'Peixoto', 'Fontes',
  'Brandão', 'Cunha', 'Farias', 'Macedo', 'Rezende', 'Sampaio'
] as const

export type ReviewBand = 'high' | 'good' | 'mixed' | 'low'

export function bandForRating(rating: number): ReviewBand {
  if (rating >= 4.5) return 'high'
  if (rating >= 3.5) return 'good'
  if (rating >= 2.5) return 'mixed'
  return 'low'
}

// {jogo} é trocado pelo nome do jogo.
export const REVIEW_TEXTS: Record<ReviewBand, readonly string[]> = {
  high: [
    'Obra-prima. Zerei e já estou com vontade de começar de novo.',
    '{jogo} me prendeu do começo ao fim. Um dos melhores jogos que já joguei.',
    'Direção de arte, trilha sonora e gameplay no mesmo nível. Não tem ponto fraco que me incomode.',
    'Joguei de madrugada mais vezes do que gostaria de admitir. Recomendo sem pensar duas vezes.',
    'Daqueles jogos que a gente lembra pelo resto da vida. A parte final me arrepiou.',
    'Perfeito não existe, mas {jogo} chega muito perto. Vale cada hora.',
    'Surpreendeu em tudo. Entrei sem expectativa e saí fã.',
    'A melhor experiência que tive nesse gênero. Já indiquei para todo mundo que conheço.',
    'Mundo vivo, personagens marcantes e uma história que não deixa a peteca cair. Nota máxima.',
    'Comecei a jogar "só um pouquinho" e quando vi tinham passado quatro horas.',
    'Cada detalhe parece ter sido pensado com carinho. É raro ver isso hoje em dia.',
    'Mecânicas simples de aprender e difíceis de largar. Genial.',
    'Mesmo depois de zerar eu volto só para ouvir a trilha e passear pelos cenários.',
    'Sem exagero: {jogo} mudou o que eu espero de um jogo.',
    'Jogo para ser jogado de peito aberto. Quanto menos você souber antes, melhor.'
  ],
  good: [
    'Muito bom. Tem alguns pontos que poderiam ser melhores, mas a experiência compensa.',
    'Gostei bastante de {jogo}. A história começa devagar, mas engata no segundo ato.',
    'Gameplay sólido e visual bonito. Faltou um pouco de ousadia para ser inesquecível.',
    'Divertido do começo ao fim, só cansa um pouco nas missões secundárias.',
    'Bom jogo, recomendo, principalmente em promoção.',
    'A ambientação é ótima e os personagens são carismáticos. O combate poderia ser mais variado.',
    'Joguei com calma e aproveitei cada parte. Alguns bugs, mas nada que estrague.',
    'Boa surpresa. Esperava menos e acabei curtindo bastante.',
    'Tem personalidade própria, e isso conta muito. A dificuldade está bem calibrada.',
    'Passei várias horas bem gastas. Não é perfeito, mas é gostoso de jogar.',
    'Ótima trilha e bom ritmo. O final podia ter sido mais ousado.',
    'Entrega o que promete. Recomendo para quem curte o estilo.',
    'As primeiras horas são excelentes, depois fica um pouco repetitivo. Ainda assim vale.'
  ],
  mixed: [
    'Tem coisas muito boas e coisas que me irritaram. No saldo, é um jogo mediano.',
    '{jogo} é bonito, mas a jogabilidade me pareceu datada. Dá para jogar, mas não empolga.',
    'Gostei da proposta, não gostei da execução. Acho que merecia mais polimento.',
    'Começa bem e perde fôlego. Terminei mais por teimosia do que por vontade.',
    'Não é ruim, só não é para mim. Entendo quem gosta.',
    'Boas ideias, mas mal aproveitadas. O potencial era enorme.',
    'Joguei até o fim esperando melhorar. Melhorou um pouco, mas não o suficiente.',
    'A história é interessante, o resto é regular. Joguei mais pelo enredo.',
    'Deu pra passar o tempo. Só não consigo recomendar sem ressalvas.'
  ],
  low: [
    'Esperava muito mais. Repetitivo e cansativo, larguei pela metade.',
    '{jogo} não me ganhou. Controles estranhos e ritmo arrastado.',
    'Visualmente bonito, mas é só isso. Não consegui me divertir.',
    'Muitos problemas técnicos e pouca graça. Pedi reembolso mentalmente.',
    'Não aguentei passar das primeiras horas. Não é para o meu gosto.',
    'Tentei algumas vezes, mas não encaixou. Prefiro jogar outra coisa.',
    'A hype passou longe da realidade. Fiquei decepcionado.',
    'Mecânicas confusas e história esquecível. Passo.'
  ]
}

// Para quem ainda não terminou o jogo (Jogando, Pausado, Larguei, ou na fila sem finalização).
export const IN_PROGRESS_REVIEW_TEXTS: Record<ReviewBand, readonly string[]> = {
  high: [
    'Ainda estou no meio, mas já dá para dizer que é especial. Não consigo parar de jogar.',
    'Poucas horas e já estou apaixonado por {jogo}. Quero ver até onde vai.',
    'Estou jogando devagar para não acabar logo. Cada hora é uma surpresa.',
    'Só joguei o começo, mas o nível de cuidado é impressionante.'
  ],
  good: [
    'Até aqui, bom. Estou gostando e pretendo terminar.',
    'Comecei faz pouco tempo e a impressão é positiva. Vamos ver como continua.',
    'Jogo sólido nas primeiras horas, sem grandes surpresas, mas bem feito.',
    'Gostei do que vi até agora. Falta jogar mais para dar uma opinião final.'
  ],
  mixed: [
    'Joguei um bom pedaço e ainda não decidi se gosto. Tem altos e baixos.',
    'Parei por um tempo porque o ritmo me cansou. Pretendo voltar para dar outra chance.',
    'As primeiras horas são estranhas, mas dá para ver o potencial.',
    'Não me conquistou ainda. Vou jogar mais um pouco antes de formar opinião.'
  ],
  low: [
    'Larguei depois de algumas horas. Não me prendeu em nenhum momento.',
    'Tentei, mas não consegui avançar. O jogo não explica nada e cansa.',
    '{jogo} não foi para mim. Parei no começo e não pretendo voltar.',
    'Controles ruins e pouca graça. Desisti cedo.'
  ]
}
