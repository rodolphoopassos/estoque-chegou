import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, writeBatch, serverTimestamp, getDoc, runTransaction, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Ingredient, CardapioItem, Movement, MovementType } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface DicionarioItem {
  id: string;
  nomeNota: string;
  idProdutoApp: string;
}

export function useInventory() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<CardapioItem[]>([]);
  const [dicionarioInsumos, setDicionarioInsumos] = useState<DicionarioItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [recipeCategories, setRecipeCategories] = useState<{id?: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);

  // Data sanitization effect
  useEffect(() => {
    if (loading || ingredients.length === 0) return;

    const sanitizeData = async () => {
      const batch = writeBatch(db);
      let needsUpdate = false;

      ingredients.forEach(ing => {
        if (typeof ing.currentStock === 'string' || typeof ing.costPrice === 'string' || typeof ing.minStock === 'string') {
          console.log(`Sanitizando insumo: ${ing.name}`);
          batch.update(doc(db, 'produtos', ing.id!), {
            currentStock: Number(ing.currentStock) || 0,
            costPrice: Number(ing.costPrice) || 0,
            minStock: Number(ing.minStock) || 0
          });
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        await batch.commit();
        console.log("Sanitização de dados concluída.");
      }
    };

    sanitizeData();
  }, [loading, ingredients.length]);

  useEffect(() => {
    const qIngredients = query(collection(db, 'produtos'), where('tipo', '==', 'insumo'));
    const unsubIngredients = onSnapshot(qIngredients, (snap) => {
      setIngredients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ingredient)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'produtos/insumo'));

    const unsubProducts = onSnapshot(collection(db, 'cardapio'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CardapioItem)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cardapio'));

    const unsubDicionario = onSnapshot(collection(db, 'dicionario_insumos'), (snap) => {
      setDicionarioInsumos(snap.docs.map(d => ({ id: d.id, ...d.data() } as DicionarioItem)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'dicionario_insumos'));

    const unsubMovements = onSnapshot(collection(db, 'movimentacoes'), (snap) => {
      setMovements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movement)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'movimentacoes'));

    const unsubCategories = onSnapshot(collection(db, 'recipeCategories'), (snap) => {
      setRecipeCategories(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'recipeCategories'));

    return () => {
      unsubIngredients();
      unsubProducts();
      unsubDicionario();
      unsubMovements();
      unsubCategories();
    };
  }, []);

  // MEMOIZED METRICS
  const metrics = useMemo(() => {
    const totalStockValue = ingredients.reduce((acc, i) => acc + (Number(i.currentStock) * Number(i.costPrice)), 0);
    const lowStock = ingredients.filter(i => Number(i.currentStock) <= Number(i.minStock));
    const totalSalesMovements = movements.filter(m => m.type === MovementType.SALE);
    const totalSalesCount = totalSalesMovements.length;

    // CMV Period calculations
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const cmvLastWeek = totalSalesMovements
      .filter(m => new Date(m.date) >= sevenDaysAgo)
      .reduce((acc, m) => acc + (m.totalCost || 0), 0);

    const cmvPrevWeek = totalSalesMovements
      .filter(m => {
        const d = new Date(m.date);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
      })
      .reduce((acc, m) => acc + (m.totalCost || 0), 0);

    const cmvTrend = cmvPrevWeek === 0 ? 0 : ((cmvLastWeek - cmvPrevWeek) / cmvPrevWeek) * 100;

    // Expiry metrics
    const expiringIngredients = ingredients.filter(i => {
      if (!i.expiryDate) return false;
      const expiry = new Date(i.expiryDate);
      const diff = expiry.getTime() - now.getTime();
      return diff > 0 && diff < (3 * 24 * 60 * 60 * 1000); // 3 days
    });

    const expiredIngredients = ingredients.filter(i => {
      if (!i.expiryDate) return false;
      return new Date(i.expiryDate) < now;
    });

    return {
      totalStockValue,
      lowStock,
      totalSalesCount,
      cmvLastWeek,
      cmvPrevWeek,
      cmvTrend,
      isTrendUp: cmvLastWeek > cmvPrevWeek,
      expiringIngredients,
      expiredIngredients
    };
  }, [ingredients, movements]);

  const productsWithCosts = useMemo(() => {
    return products.map(product => {
      const cost = (product.ficha_tecnica || []).reduce((acc, item) => {
        const ing = ingredients.find(i => i.id === item.insumoId);
        return acc + (Number(item.quantidade) * (Number(ing?.costPrice) || 0));
      }, 0);
      const margin = product.preco_venda > 0 ? ((product.preco_venda - cost) / product.preco_venda) * 100 : 0;
      return { ...product, cost, margin };
    });
  }, [products, ingredients]);

  const addIngredient = async (item: Omit<Ingredient, 'id'>, autoLink: boolean = false) => {
    try {
      const docRef = await addDoc(collection(db, 'produtos'), {
        ...item,
        tipo: 'insumo',
        lastUpdated: new Date().toISOString()
      });

      if (autoLink) {
        // Auto-create a product in cardapio linked to this ingredient
        await addDoc(collection(db, 'cardapio'), {
          nome: item.name,
          categoria: item.category === 'gelados' ? 'BEBIDAS' : 'OUTROS',
          preco_venda: item.costPrice * 1.5, // Default markup 50%
          ficha_tecnica: [{
            insumoId: docRef.id,
            nome_insumo: item.name,
            quantidade: 1
          }]
        });
      }
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'produtos/insumo');
      throw error;
    }
  };

  const updateIngredient = async (id: string, updates: Partial<Ingredient>) => {
    try {
      await updateDoc(doc(db, 'produtos', id), {
        ...updates,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'produtos/insumo');
    }
  };

  const deleteIngredient = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'produtos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'produtos/insumo');
    }
  };

  const updateProduct = async (id: string, updates: Partial<CardapioItem>) => {
    try {
      await updateDoc(doc(db, 'cardapio', id), {
        ...updates
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'cardapio');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'cardapio', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'cardapio');
    }
  };

  const deleteMovement = async (id: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const movementRef = doc(db, 'movimentacoes', id);
        const movementSnap = await transaction.get(movementRef);
        
        if (!movementSnap.exists()) return;
        const movement = movementSnap.data() as Movement;

        // Reverter alterações de estoque
        if (movement.items && movement.items.length > 0) {
          // Fase 1: Ler todos os documentos
          const ingredientRefs = movement.items.map(item => ({
            item,
            ref: doc(db, 'produtos', item.ingredientId)
          }));
          
          for (const mapped of ingredientRefs) {
             const snap = await transaction.get(mapped.ref);
             (mapped as any).exists = snap.exists();
          }

          // Fase 2: Aplicar todas as escritas
          for (const mapped of ingredientRefs) {
            if ((mapped as any).exists) {
              const modifier = movement.type === 'IN' ? -1 : 1; 
              const diff = Number(mapped.item.quantity) * modifier;
              
              transaction.update(mapped.ref, {
                currentStock: increment(diff),
                lastUpdated: new Date().toISOString()
              });
            }
          }
        }

        transaction.delete(movementRef);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'movimentacoes');
    }
  };

  const sellProduct = async (cart: { productId: string; quantity: number; salePrice: number }[], paymentMethod: string, deliveryFee: number) => {
    if (cart.length === 0) return;

    try {
      const batch = writeBatch(db);
      const allMovementItems: any[] = [];
      let totalSaleCost = 0;
      let totalRevenue = deliveryFee;
      
      const ingredientNeededMap = new Map<string, { decrement: number, unit: string, name: string }>();

      for (const cartItem of cart) {
        totalRevenue += cartItem.salePrice * cartItem.quantity;
        const product = products.find(p => p.id === cartItem.productId);
        if (!product) continue;

        let effectiveRecipe = product.ficha_tecnica || [];
        
        if (effectiveRecipe.length === 0) {
          console.log(`Produto ${product.nome} sem ficha técnica. Tentando auto-vínculo por nome...`);
          const matchingIng = ingredients.find(i => 
            i.name.trim().toLowerCase() === product.nome.trim().toLowerCase()
          );
          
          if (matchingIng) {
            console.log(`Link automático encontrado para ${product.nome} -> ${matchingIng.name}`);
            effectiveRecipe = [{ insumoId: matchingIng.id!, quantidade: 1, nome_insumo: matchingIng.name }];
          } else {
            console.warn(`Nenhum insumo encontrado com o nome exato de "${product.nome}" para baixar estoque.`);
          }
        }

        console.log(`Processando ${product.nome}: ${effectiveRecipe.length} itens na ficha.`);

        for (const recipeItem of effectiveRecipe) {
           const decrementAmount = Number(recipeItem.quantidade) * Number(cartItem.quantity);
           const ingId = recipeItem.insumoId;
           const ingData = ingredients.find(i => i.id === ingId);
           const unit = ingData ? ingData.unit : '';
           
           if (ingredientNeededMap.has(ingId)) {
               const existing = ingredientNeededMap.get(ingId)!;
               existing.decrement += decrementAmount;
           } else {
               ingredientNeededMap.set(ingId, {
                   decrement: decrementAmount,
                   unit: unit,
                   name: ""
               });
           }
        }
      }

      for (const [ingId, needed] of ingredientNeededMap.entries()) {
           const ingData = ingredients.find(i => i.id === ingId);
           if (ingData) {
             const ingredientRef = doc(db, 'produtos', ingId);
             
             batch.update(ingredientRef, {
               currentStock: increment(-needed.decrement),
               lastUpdated: new Date().toISOString()
             });

             allMovementItems.push({
               ingredientId: ingId,
               name: ingData.name,
               quantity: needed.decrement,
               unit: needed.unit
             });

             totalSaleCost += needed.decrement * (Number(ingData.costPrice) || 0);
           }
      }

      const movementRef = doc(collection(db, 'movimentacoes'));
      batch.set(movementRef, {
        type: MovementType.SALE,
        date: new Date().toISOString(),
        description: `Venda PDV: ${cart.length} item(s) - ${paymentMethod}`,
        items: allMovementItems,
        totalCost: totalSaleCost,
        revenue: totalRevenue,
        paymentMethod,
        deliveryFee
      });

      batch.set(doc(collection(db, 'transacoes')), {
        tipo: 'receita',
        valor: totalRevenue,
        categoria: 'venda',
        data: new Date().toISOString(),
        descricao: `Venda PDV: ${cart.length} item(s) - ${paymentMethod}`
      });

      await batch.commit();
      console.log("Baixa de estoque e venda efetuada via batch!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'batch-checkout');
    }
  };

  const addStock = async (items: { ingredientId: string; quantity: number; costPrice?: number; expiryDate?: string; extractedName?: string }[], paymentSource?: 'dinheiro' | 'banco' | 'cartao') => {
    try {
      const batch = writeBatch(db);
      const movementItems = [];
      let totalCost = 0;

      for (const item of items) {
        const ing = ingredients.find(i => i.id === item.ingredientId);
        if (ing) {
          const newStock = ing.currentStock + item.quantity;
          const newCost = item.costPrice 
            ? ((ing.currentStock * ing.costPrice) + (item.quantity * item.costPrice)) / newStock
            : ing.costPrice;

          const updateData: any = {
            currentStock: newStock,
            costPrice: newCost,
            lastUpdated: new Date().toISOString()
          };

          if (item.expiryDate) {
            // Update expiryDate if it's not set or the new date is earlier
            if (!ing.expiryDate || new Date(item.expiryDate) < new Date(ing.expiryDate)) {
              updateData.expiryDate = item.expiryDate;
            }
          }

          batch.update(doc(db, 'produtos', ing.id!), updateData);

          // C: Aprendizado - Atualizar dicionario_insumos
          if (item.extractedName) {
            const existingMapping = dicionarioInsumos.find(d => d.nomeNota === item.extractedName);
            if (!existingMapping) {
              const newDictRef = doc(collection(db, 'dicionario_insumos'));
              batch.set(newDictRef, {
                nomeNota: item.extractedName,
                idProdutoApp: item.ingredientId
              });
            } else if (existingMapping.idProdutoApp !== item.ingredientId) {
              batch.update(doc(db, 'dicionario_insumos', existingMapping.id), {
                idProdutoApp: item.ingredientId
              });
            }
          }

          movementItems.push({
            ingredientId: item.ingredientId,
            name: ing.name,
            quantity: item.quantity,
            unit: ing.unit
          });
          totalCost += item.quantity * (item.costPrice || ing.costPrice);
        }
      }

      const allItemNames = movementItems.map(m => m.name).join(', ');

      const movementRef = doc(collection(db, 'movimentacoes'));
      batch.set(movementRef, {
        type: MovementType.IN,
        date: new Date().toISOString(),
        description: "Entrada de Mercadorias (Manual/XML)",
        items: movementItems,
        totalCost
      });

      if (totalCost > 0) {
        batch.set(doc(collection(db, 'transacoes')), {
          tipo: 'despesa',
          valor: totalCost,
          categoria: 'insumo',
          data: new Date().toISOString(),
          descricao: `Compra de Estoque: ${allItemNames}`,
          itens_comprados: movementItems.map((mi) => {
            const item = items.find(i => i.ingredientId === mi.ingredientId);
            return {
              ingredientId: mi.ingredientId,
              name: mi.name,
              quantity: mi.quantity,
              unit: mi.unit,
              costPrice: item?.costPrice || 0,
              supplier: "Desconhecido" // Default supplier since it's not currently passed
            };
          })
        });
      }

      // Deduct from selected payment source (saldos_contas)
      if (paymentSource && totalCost > 0) {
        const saldoRef = doc(db, 'saldos_contas', paymentSource);
        batch.update(saldoRef, {
          valor_atual: increment(-totalCost)
        });
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'batch-stock-in');
    }
  };

  const addRecipeCategory = async (name: string) => {
    try {
      await addDoc(collection(db, 'recipeCategories'), { name });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'recipeCategories');
    }
  };

  const updateRecipeCategory = async (id: string, name: string) => {
    try {
      await updateDoc(doc(db, 'recipeCategories', id), { name });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'recipeCategories');
    }
  };

  const deleteRecipeCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recipeCategories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'recipeCategories');
    }
  };

  const addWaste = async (ingredientId: string, quantity: number, reason: string) => {
    try {
      const batch = writeBatch(db);
      const ing = ingredients.find(i => i.id === ingredientId);
      if (!ing) return;

      batch.update(doc(db, 'produtos', ingredientId), {
        currentStock: increment(-quantity),
        lastUpdated: new Date().toISOString()
      });

      const movementRef = doc(collection(db, 'movimentacoes'));
      batch.set(movementRef, {
        type: MovementType.WASTE,
        date: new Date().toISOString(),
        description: `Perda/Descarte: ${reason}`,
        items: [{
          ingredientId,
          quantity,
          unit: ing.unit
        }],
        totalCost: quantity * ing.costPrice
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'add-waste');
    }
  };

  return {
    ingredients,
    products,
    dicionarioInsumos,
    productsWithCosts,
    movements,
    recipeCategories,
    metrics,
    loading,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    updateProduct,
    deleteProduct,
    deleteMovement,
    sellProduct,
    addStock,
    addWaste,
    addRecipeCategory,
    updateRecipeCategory,
    deleteRecipeCategory
  };
}
