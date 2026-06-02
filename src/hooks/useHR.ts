import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export type Employee = {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive';
  valor_diaria: number;
};

export type Presence = {
  id?: string;
  funcionarioId: string;
  data: string;
  presente: boolean;
};

export function useHR() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'funcionarios'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'funcionarios'));

    const unsubPresences = onSnapshot(collection(db, 'ponto_diario'), (snap) => {
      setPresences(snap.docs.map(d => ({ id: d.id, ...d.data() } as Presence)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'ponto_diario'));

    return () => {
      unsubEmployees();
      unsubPresences();
    };
  }, []);

  const addEmployee = async (employee: Omit<Employee, 'id'>) => {
    try {
      await addDoc(collection(db, 'funcionarios'), employee);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'funcionarios');
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      await updateDoc(doc(db, 'funcionarios', id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'funcionarios');
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'funcionarios', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'funcionarios');
    }
  };

  const savePresences = async (date: string, presencesData: { funcionarioId: string, presente: boolean }[]) => {
    try {
      const batch = writeBatch(db);
      
      const newPresences = presencesData.filter(p => p.presente);

      for (const presenceData of newPresences) {
        const docId = `${presenceData.funcionarioId}_${date}`;
        const newDocRef = doc(db, 'ponto_diario', docId);
        batch.set(newDocRef, { funcionarioId: presenceData.funcionarioId, data: date, presente: presenceData.presente }, { merge: true });
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ponto_diario');
    }
  };

  return {
    employees,
    presences,
    loading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    savePresences
  };
}

