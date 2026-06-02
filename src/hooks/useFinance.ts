import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, doc, writeBatch, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export type TransactionType = 'receita' | 'despesa';
export type TransactionCategory = 'venda' | 'insumo' | 'rh' | 'outros' | string;

export interface Transaction {
  id?: string;
  descricao: string;
  valor: number;
  tipo: TransactionType;
  categoria: TransactionCategory;
  data: string;
}

export function useFinance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'transacoes'), orderBy('data', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transacoes'));

    return () => unsub();
  }, []);

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    try {
      await addDoc(collection(db, 'transacoes'), transaction);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transacoes');
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transacoes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transacoes');
    }
  };

  return {
    transactions,
    loading,
    addTransaction,
    deleteTransaction
  };
}
