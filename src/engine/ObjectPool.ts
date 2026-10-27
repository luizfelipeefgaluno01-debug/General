/**
 * Object Pool de tamanho fixo. Todos os objetos são pré-alocados na criação,
 * então o loop principal nunca instancia projéteis/partículas/explosões
 * (zero pressão sobre o Garbage Collector durante a partida).
 */
export interface Poolable {
  active: boolean;
}

export class ObjectPool<T extends Poolable> {
  /** Acesso direto para iteração com `for` clássico (sem closures por frame). */
  readonly items: readonly T[];
  private cursor = 0;
  private activeCount = 0;

  constructor(factory: () => T, size: number) {
    const list: T[] = [];
    for (let i = 0; i < size; i++) {
      const item = factory();
      item.active = false;
      list.push(item);
    }
    this.items = list;
  }

  /** Retorna um objeto livre (já marcado como ativo) ou `null` se o pool estiver cheio. */
  acquire(): T | null {
    const len = this.items.length;
    for (let n = 0; n < len; n++) {
      const index = (this.cursor + n) % len;
      const item = this.items[index];
      if (item !== undefined && !item.active) {
        item.active = true;
        this.cursor = (index + 1) % len;
        this.activeCount++;
        return item;
      }
    }
    return null;
  }

  release(item: T): void {
    if (item.active) {
      item.active = false;
      this.activeCount--;
    }
  }

  releaseAll(): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item !== undefined) item.active = false;
    }
    this.activeCount = 0;
    this.cursor = 0;
  }

  get size(): number {
    return this.items.length;
  }

  get inUse(): number {
    return this.activeCount;
  }
}
