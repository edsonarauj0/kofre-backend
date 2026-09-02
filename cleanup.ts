import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
config({ path: 'd:/Projetos/Kofre/backend-ts/.env.local' });

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  })
});

const db = getFirestore();

async function cleanup() {
  const snapshot = await db.collectionGroup('transacoes')
    .where('origem', '==', 'fatura')
    .get();

  let count = 0;
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.tipo === 'despesa' || !data.perfilFinanceiroId) {
      batch.delete(doc.ref);
      count++;
    }
  }

  const importacoesSnap = await db.collectionGroup('importacoes').get();
  for (const doc of importacoesSnap.docs) {
    const data = doc.data();
    if (!data.referencia || data.totalTransacoes === undefined) {
      batch.delete(doc.ref);
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Deleted ${count} broken records (transacoes and importacoes).`);
  } else {
    console.log('No broken records found.');
  }
}

cleanup().catch(console.error);
