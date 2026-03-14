import { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  deleteDoc, 
  doc,
  setDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

export interface Transaction {
  id: string;
  productName: string;
  category: string;
  price: number;
  quantity: number;
  gender: 'Male' | 'Female';
  age: 'Kid' | 'Teen' | 'Adult';
  vehicle?: 'Car' | 'Bike' | 'Cycle' | 'None';
  timestamp: number;
  userId: string;
}

export interface ShopMemory {
  userId: string;
  facts: string[];
  shopDescription: string;
  photos?: string[];
  language?: 'en' | 'hi';
  lastUpdated: number;
}

export const exportData = (transactions: Transaction[]) => {
  const dataStr = JSON.stringify(transactions, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dka-shop-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      
      // Sort client-side to avoid needing a composite index
      txs.sort((a, b) => b.timestamp - a.timestamp);
      
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const addTransaction = async (t: Omit<Transaction, 'id' | 'timestamp' | 'userId'>) => {
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'transactions'), {
        ...t,
        timestamp: Date.now(),
        userId: auth.currentUser.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'transactions', id), updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'transactions');
    }
  };

  const clearData = async () => {
    if (!auth.currentUser) return;
    
    // In a real app, we'd use a batch or cloud function for bulk delete
    // For this scale, we'll delete them individually
    try {
      const deletePromises = transactions.map(t => deleteDoc(doc(db, 'transactions', t.id)));
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
    }
  };

  return { transactions, addTransaction, updateTransaction, clearData, loading };
}

export function useShopMemory() {
  const [memory, setMemory] = useState<ShopMemory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) {
      setMemory(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'shop_memory', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setMemory(docSnap.data() as ShopMemory);
      } else {
        setMemory({
          userId: auth.currentUser!.uid,
          facts: [],
          shopDescription: '',
          language: 'en',
          lastUpdated: Date.now()
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shop_memory');
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const updateMemory = async (updates: Partial<ShopMemory>) => {
    if (!auth.currentUser) return;
    try {
      const newMemory = {
        userId: auth.currentUser.uid,
        facts: memory?.facts || [],
        shopDescription: memory?.shopDescription || '',
        ...updates,
        lastUpdated: Date.now()
      };
      await setDoc(doc(db, 'shop_memory', auth.currentUser.uid), newMemory);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'shop_memory');
    }
  };

  return { memory, updateMemory, loading };
}
