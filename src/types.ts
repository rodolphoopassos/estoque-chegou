export enum MovementType {
  IN = 'IN',
  OUT = 'OUT',
  SALE = 'SALE',
  WASTE = 'WASTE'
}

export interface Ingredient {
  id?: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPrice: number;
  lastUpdated: string;
  category?: string;
  expiryDate?: string;
  targetPrice?: number;
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface FichaTecnicaItem {
  insumoId: string;
  nome_insumo: string;
  quantidade: number;
}

export interface CardapioItem {
  id?: string;
  nome: string;
  categoria: string;
  preco_venda: number;
  ficha_tecnica: FichaTecnicaItem[];
}

export interface RecipeCategory {
  id?: string;
  name: string;
}

export interface Movement {
  id?: string;
  type: MovementType;
  date: string;
  totalCost?: number;
  description: string;
  items: {
    ingredientId: string;
    quantity: number;
    unit: string;
  }[];
}
