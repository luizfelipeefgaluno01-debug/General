import type { ReactNode } from 'react';

const ROWS: readonly (readonly [string, string, string])[] = [
  ['MOVER', 'W A S D', 'SETAS'],
  ['ATIRAR', 'ESPAÇO / CLIQUE', 'ENTER / NUM 0'],
  ['MIRAR', 'MOUSE OU MOVIMENTO', 'MOVIMENTO'],
  ['MUNIÇÃO', 'Q', 'SHIFT DIR. / NUM 1'],
  ['PAUSAR', 'ESC / P', 'ESC / P']
];

export function ControlsTable(): ReactNode {
  return (
    <table className="controls-table">
      <thead>
        <tr>
          <th>AÇÃO</th>
          <th className="p1">JOGADOR 1</th>
          <th className="p2">JOGADOR 2</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(([action, p1, p2]) => (
          <tr key={action}>
            <td>{action}</td>
            <td>{p1}</td>
            <td>{p2}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
