const admin = require('firebase-admin');
const path = require('path');

// Đường dẫn trỏ tới file key bạn tải từ Firebase Console
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = { db, admin };