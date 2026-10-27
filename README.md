# General da Guerra

Jogo retrô de combate com tanques (visão de cima), feito em **React + TypeScript + HTML5 Canvas**, empacotado com **Vite**.

## Como rodar

```bash
npm install
npm run dev       # desenvolvimento em http://localhost:5173
npm run build     # checagem de tipos (tsc strict) + build de produção em dist/
npm run preview   # serve o build em http://localhost:4173
```

> A pasta `dist/` já vem compilada. Para jogar sem instalar nada, sirva essa pasta com qualquer servidor estático
> (ex.: `npx serve dist`). Abrir o `index.html` direto pelo explorador de arquivos não funciona, porque navegadores bloqueiam módulos JS em `file://`.

## Publicar no GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica automaticamente o conteúdo de `dist/` no GitHub Pages quando há um push para a branch `main`. O `index.html` na raiz é apenas a entrada de desenvolvimento do Vite; ele **não** é enviado ao Pages. Após `npm run build`, o workflow envia exclusivamente `dist/`, que contém o HTML compilado, os scripts, estilos, fontes e demais recursos prontos para produção.

Para publicar, envie o projeto ao GitHub, selecione **Settings > Pages > Source > GitHub Actions** no repositório e aguarde a conclusão do workflow na aba **Actions**. Também é possível iniciar a publicação manualmente pela opção **Run workflow**.

O Vite usa `base: './'`, então os arquivos compilados funcionam tanto na URL de um repositório de projeto do GitHub Pages quanto em hospedagem local.

## Modos de jogo

| Modo | Descrição |
|---|---|
| **PLAYER** | 1 jogador contra ondas infinitas de inimigos. |
| **MULTIPLAYER > CO-OP** | P1 + P2 no mesmo teclado contra a IA (ondas 1,5x maiores). |
| **MULTIPLAYER > VERSUS** | P1 x P2, 5 vidas cada. Quem zerar as vidas do outro vence. |

## Controles

| Ação | Jogador 1 | Jogador 2 |
|---|---|---|
| Mover | W A S D (no solo, setas também) | Setas |
| Atirar | Espaço / clique do mouse | Enter / Num 0 |
| Mirar | Mouse (ou direção do movimento, nas opções) | Direção do movimento |
| Trocar munição | Q | Shift direito / Num 1 |
| Pausar | Esc / P | Esc / P |

Menus: setas ↑/↓ + Enter, ou mouse.

## Mecânicas

- **Munições:** Padrão (equilibrada), Pesada (lenta, dano em área), Rajada (cadência altíssima, dano baixo). Cada uma com cooldown próprio.
- **Inimigos:** Soldados (rápidos, atacam em formação em "V"), Tanques Leves (mantêm distância e fazem strafe), Artilharia Pesada (dispara obuses em arco com aviso no chão e dano em área).
- **Power-ups:** Escudo (8 s de imunidade), Tiro Duplo (10 s), Reparo (+40 de vida). Caem de inimigos e aparecem no mapa; timers ficam visíveis no HUD.
- **Colisão:** círculos (projéteis x entidades) e círculo x AABB (entidades x obstáculos).

## Arquitetura

```
src/
├── types/game.ts              # Interfaces: entidades, estados (menu/playing/paused/gameover), jogadores, projéteis, inimigos
├── engine/
│   ├── GameLoop.ts            # requestAnimationFrame + deltaTime limitado
│   ├── ObjectPool.ts          # Pools pré-alocados (projéteis, partículas, explosões, inimigos...)
│   ├── Renderer.ts            # Sprites pré-renderizados offscreen, desenho com Math.floor
│   ├── Input.ts               # Teclado por KeyboardEvent.code (P1 e P2 sem conflito) + mouse
│   └── Audio.ts               # SFX 8-bit sintetizados com WebAudio
├── game/
│   ├── config.ts              # Balanceamento, controles, obstáculos, tamanhos dos pools
│   └── createGame.ts          # Motor do jogo (estado privado em closure)
├── security/
│   ├── sanitize.ts            # sanitizeInput(), sanitizeName(), sanitizeRoomName(), validação de settings
│   ├── guards.ts              # Checagem de NaN/Infinity e limites físicos
│   └── logger.ts              # Logger seguro com buffer interno e redação de dados sensíveis
├── store/
│   ├── gameStore.ts           # Store customizada em closure, snapshots congelados
│   └── GameStoreContext.tsx   # useContext + useSyncExternalStore
├── components/                # MainMenu, Hud, PauseOverlay, GameOverScreen, GameCanvas, ErrorBoundary
└── styles/global.css          # Estética retrô / CRT
```

## Segurança (7 camadas aplicadas)

1. **Validação de entrada:** todo texto passa por `sanitizeInput()` (remove tags, protocolos `javascript:`, handlers `on*=`, caracteres de controle/bidi e símbolos fora da whitelist) com limite de tamanho.
2. **Sanitização de dados persistidos:** configurações do `localStorage` são revalidadas campo a campo (`validateSettings`).
3. **Saída segura:** React escapa todo o texto; nenhum `dangerouslySetInnerHTML`, `eval` ou `alert()/confirm()`.
4. **Encapsulamento de estado:** `score`, `health` e o game loop vivem dentro da closure de `createGame`; a store expõe apenas snapshots `Object.freeze` e ações. Nada é exposto em `window`.
5. **Programação defensiva:** posições/velocidades checadas contra `NaN`/`Infinity` e presas aos limites da arena a cada frame; dano e delta validados.
6. **Logging seguro:** em produção o console mostra apenas códigos genéricos; detalhes ficam num buffer interno com tokens/senhas mascarados. Erros globais e promises rejeitadas são capturados.
7. **Content-Security-Policy:** o build injeta CSP restritiva (`script-src 'self'`, `object-src 'none'`, `form-action 'none'`) e `referrer no-referrer`.

## Performance

- Loop único com `requestAnimationFrame` e `deltaTime` (velocidade idêntica em 60/120/144 Hz).
- Coordenadas de desenho sempre inteiras (`Math.floor`).
- **Object Pooling** para projéteis, obuses, partículas, explosões, power-ups, textos e inimigos: zero alocação desses objetos durante a partida.
- Cenário e obstáculos pré-renderizados num canvas offscreen; sprites dos tanques também.
- HUD em React atualizado a 10 Hz (não a cada frame).
