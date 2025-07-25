import React, { useEffect, useState } from 'react';
import { TextField, Button, Card } from '@shopify/polaris';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase'; // this must point to your actual db export

const AdminSettings = ({ storeId }) => {
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchCategory = async () => {
      if (!storeId) return;
      const docRef = doc(db, 'storeSettings', storeId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCategory(docSnap.data().category || '');
      }
    };
    fetchCategory();
  }, [storeId]);

  const handleSave = async () => {
    if (!storeId) return;
    setLoading(true);
    await setDoc(doc(db, 'storeSettings', storeId), { category });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setLoading(false);
  };

  return (
    <Card sectioned title="Store Category">
      <TextField
        label="Category for Product Recommendations"
        value={category}
        onChange={setCategory}
        helpText="Examples: 'Beauty', 'Fishing Gear', 'Garden Care'"
        autoComplete="off"
      />
      <Button onClick={handleSave} loading={loading} primary>
        Save Category
      </Button>
      {saved && <p style={{ marginTop: '10px' }}>✅ Saved!</p>}
    </Card>
  );
};

export default AdminSettings;
