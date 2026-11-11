# Servidor do Expulso da Liga

Esta pasta é tudo o que precisa ir para a internet. O servidor faz duas coisas:

- **Entrega o jogo:** os arquivos da pasta `public/` (o jogo já pronto).
- **Cuida das salas:**
  - cria salas com código (ex.: K7Q-M2P);
  - lista as salas públicas em `/rooms`;
  - repassa as mensagens entre o host e os outros jogadores.

A partida em si roda no navegador de quem criou a sala, por isso o servidor é leve. Num plano gratuito ele aguenta centenas de salas.

## Rodar no seu PC
1. Instale o Node.js 18 ou mais novo.
2. Nesta pasta, rode `npm install` e depois `npm start`.
3. Abra http://localhost:8080 no navegador. Para testar online sozinho, abra em duas abas (ou no celular, pelo IP do PC na mesma rede).

## Publicar de graça no Render
1. Crie um repositório no GitHub só com o conteúdo desta pasta: `server.js`, `package.json`, `render.yaml` e a pasta `public/`.
2. Em render.com, crie uma conta, clique em **New > Blueprint** e escolha o repositório. O Render lê o `render.yaml` sozinho.
3. No fim, ele mostra um endereço tipo `https://expulso-da-liga.onrender.com`. Esse é o link do jogo para mandar para a galera.

No plano gratuito, o servidor "dorme" depois de 15 minutos sem ninguém. Quem abrir o jogo nessa hora espera uns 30 a 60 segundos enquanto ele acorda. Se isso incomodar, o plano pago mais barato do Render (ou uma VPS pequena) resolve.

## Endereços
- `/`: o jogo.
- `/rooms`: salas públicas esperando jogadores (JSON).
- `/health`: responde "ok" e quantas salas estão abertas.
- WebSocket na raiz: a conexão das partidas.
