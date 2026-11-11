# Expulso da Liga: jogo de navegador

Party game de super-heróis, grátis no navegador. A cada rodada, cada um joga a reação menos pior para a Cena, o grupo debate e o Chefe da Liga escolhe a pior. Quem chega a 3 Advertências é expulso e a partida acaba.

Feito com HTML, CSS e TypeScript, sem motor de jogo. O menu abre com uns 400 KB; o resto das imagens dos heróis (5 MB) carrega em seguida, enquanto você navega.

## As duas pastas
- **`servidor/`:** é o que vai para a internet. Entrega o jogo e cuida das salas. Já vem com o jogo pronto dentro de `public/`.
- **`jogo/`:** o código do jogo. Só precisa mexer aqui para mudar alguma coisa.

## Jogar no seu PC
1. Instale o Node.js 18 ou mais novo (nodejs.org).
2. Na pasta `servidor`, rode `npm install` e depois `npm start`.
3. Abra http://localhost:8080.
   - **ROBÔS:** joga sozinho na hora.
   - **Online:** abra outra aba (ou o celular na mesma rede, pelo IP do PC) e entre com o código da sala.

## Publicar
Siga o LEIA-ME da pasta `servidor`: é um repositório no GitHub e um Blueprint no Render, de graça. O endereço que o Render der é o link do jogo.

Se preferir colocar o jogo no itch.io:
1. Zipe o conteúdo de `servidor/public`.
2. No `index.html`, troque `window.EDL_SERVER = "";` pelo endereço do servidor, tipo `"wss://expulso-da-liga.onrender.com"`.
3. Suba no itch.io como projeto **HTML**.

## Mudar o jogo
1. Na pasta `jogo`, rode `npm install` (só na primeira vez).
2. Depois de mudar o código, rode `npm run build`. Ele gera o jogo e copia sozinho para `servidor/public`.

Onde fica cada coisa:
- `src/cards.ts`: as 40 Cenas e as 84 Reações da Versão 3.
- `src/game.ts`: as regras, os robôs e o código da sala.
- `src/events.ts`: os 10 Eventos e as adaptações para o online.
- `src/voice.ts`: a voz (WebRTC).
- `src/sound.ts`: efeitos sonoros e música (`public/musica.mp3`).
- `src/net.ts`: a conexão com o servidor.
- `src/screens/table.ts`: a mesa, a sala de espera, a pausa e o fim.
- `src/screens/menus.ts`: os menus.
- `src/style.css`: o visual. O layout da mesa é o que você aprovou: 1440×810, ampliado para qualquer tela, inclusive 4K.
  - No celular, tudo vira uma coluna.
- `public/arte/`: os heróis (6 expressões e o corpo) e o verso da carta.

## O que dá para fazer
- **Menu:** Jogar, Robôs, Herói, Regras e Opções.
- **Jogar:**
  - **Partida rápida:** entra na sala pública mais cheia.
  - **Robôs:** de 2 a 7 robôs.
  - **Criar sala:** pública ou privada, com tempos e número de Advertências.
  - **Salas abertas:** as salas públicas do servidor.
  - **Entrar com código.**
  - **Link de convite:** `?sala=CÓDIGO`, com botão de copiar na sala de espera.
- **Regras:**
  - debate sem limite de tempo; o Chefe confirma a pior e a mesa tem 10 segundos para fazer ele mudar de ideia;
  - todos podem votar na carta que acham a pior, até na própria para blefar, mas quem decide é o Chefe;
  - os 10 Eventos (Ordem de cima, Reprise, Cláusula de silêncio, Transmissão com delay, Voto popular, Polêmica dá audiência, Troca de roteiro, Bode expiatório, Delação, Indulto de fim de ano) misturados às Cenas, a partir da segunda rodada.
- **Voz:** nas partidas online, cada um liga o microfone quando quiser (botão ao lado do chat ou tecla M) e fala a partida inteira. O áudio vai direto entre os jogadores; o servidor só apresenta um ao outro. Na Reunião no mudo, os microfones são cortados durante o debate. Volume da voz em Opções.
  - Se alguém em rede de celular ou de empresa não conseguir ouvir, ligue um servidor TURN (repasse de voz). No Render, em **Environment**, adicione:
    - Cloudflare (grátis até 1 TB/mês): `CF_TURN_KEY_ID` e `CF_TURN_TOKEN` (crie a chave em Cloudflare > Realtime > TURN Server);
    - ou qualquer outro TURN: `TURN_URLS` (separadas por vírgula), `TURN_USERNAME` e `TURN_CREDENTIAL`.
    O jogo busca isso em `/turn` sozinho; não precisa mexer no código.
- **Som:** música de fundo (ElevenLabs) e efeitos sonoros, com volume e chave separados em Opções.
- **Na partida:**
  - Teclas:
    - **1–5** escolhe a carta e **Enter** joga.
    - O Chefe escolhe com **A–H** ou **1–8**.
    - **T** abre o chat.
    - **Esc** abre o menu.
  - No menu dá para silenciar alguém. O host também pode tirar alguém da sala.
  - No treino com robôs, o menu pausa o jogo.

## Ainda não
- A Rodada Final de desempate pelo título de Herói do Mês (hoje o empate só é anunciado).

As ilustrações dos heróis foram geradas com IA. Vale dizer isso na página do jogo.
Fontes: Lilita One e Fredoka, sob a SIL Open Font License (os arquivos OFL estão em `public/fonts/`).
