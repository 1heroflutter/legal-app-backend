const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const path = require('path');
const { generateEmbedding } = require('../services/aiService'); // Temporarily keep the link to aiService
const { serviceAccount } = require('../config/firebase');

class FirestoreRepository {
    async findSimilarJudgmentsREST(userQuery) {
        try {
            console.log("🔍 [FirestoreRepo] Đang tìm kiếm bản án tương đồng cho:", userQuery);

            // 1. Tạo Vector (Nên tách ra Use Case, nhưng tạm để đây cho khớp flow hiện tại)
            const queryVector = await generateEmbedding(userQuery);
            if (!queryVector) {
                console.error("❌ Không tạo được vector");
                return [];
            }

            // 2. Lấy project ID từ service account
            const projectId = serviceAccount.project_id;

            // 3. Lấy access token từ service account
            console.log("🔑 [FirestoreRepo] Đang xác thực với Google...");
            const auth = new GoogleAuth({
                credentials: serviceAccount,
                scopes: ['https://www.googleapis.com/auth/datastore'],
            });
            const client = await auth.getClient();
            const tokenResponse = await client.getAccessToken();
            const accessToken = tokenResponse.token;

            // 4. Gọi Firestore REST API để vector search
            console.log("📡 [FirestoreRepo] Đang gọi Firestore REST API (vector search)...");
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

            const requestBody = {
                structuredQuery: {
                    from: [{ collectionId: "judgments" }],
                    findNearest: {
                        vectorField: { fieldPath: "embedding_vector" },
                        queryVector: {
                            mapValue: {
                                fields: {
                                    __type__: { stringValue: "__vector__" },
                                    value: {
                                        arrayValue: {
                                            values: queryVector.map(v => ({ doubleValue: v }))
                                        }
                                    }
                                }
                            }
                        },
                        distanceMeasure: "COSINE",
                        limit: 5
                    },
                }
            };

            const response = await axios.post(url, requestBody, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });

            console.log(`📊 [FirestoreRepo] REST API phản hồi thành công.`);

            // 5. Parse kết quả
            const results = [];
            if (response.data && Array.isArray(response.data)) {
                for (const item of response.data) {
                    if (item.document && item.document.fields) {
                        const fields = item.document.fields;
                        results.push({
                            so_ban_an: fields.so_ban_an?.stringValue || "N/A",
                            ngay_tuyen: fields.ngay_tuyen?.stringValue || "N/A",
                            toi_danh: fields.toi_danh?.stringValue || "Không xác định",
                            hanh_vi: fields.chi_tiet_vu_an?.mapValue?.fields?.hanh_vi?.stringValue || "N/A",
                            hinh_phat: fields.phap_ly?.mapValue?.fields?.hinh_phat?.stringValue || "N/A",
                            dieu_luat: fields.phap_ly?.mapValue?.fields?.dieu_luat_day_du?.stringValue || "N/A",
                        });
                    }
                }
            }

            console.log(`📊 [FirestoreRepo] Tìm thấy ${results.length} bản án.`);
            return results;
        } catch (error) {
            console.error("❌ Lỗi findSimilarJudgments (REST) trong FirestoreRepository:");
            if (error.response) {
                console.error("  Status:", error.response.status);
                // console.error("  Data:", JSON.stringify(error.response.data, null, 2));
            } else {
                console.error("  Message:", error.message);
            }
            return []; // Return empty instead of crashing
        }
    }
}

module.exports = new FirestoreRepository();
