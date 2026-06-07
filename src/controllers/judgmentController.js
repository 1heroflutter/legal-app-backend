const { db } = require('../config/firebase');

/**
 * GET /api/judgments/random?limit=5
 * Lấy ngẫu nhiên N bản án từ Firestore để hiển thị trên Home Screen
 */
const getRandomJudgments = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;

        // Lấy toàn bộ bản án (chỉ lấy các trường cần thiết, không lấy embedding_vector nặng)
        const snapshot = await db.collection('judgments').get();

        if (snapshot.empty) {
            return res.json({ judgments: [] });
        }

        // Map ra danh sách gọn nhẹ
        const allJudgments = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Chỉ lấy bản án có đầy đủ thông tin cơ bản
            if (data.so_ban_an && data.toi_danh) {
                allJudgments.push({
                    id: doc.id,
                    so_ban_an: data.so_ban_an || '',
                    ngay_tuyen: data.ngay_tuyen || '',
                    toi_danh: data.toi_danh || '',
                    hanh_vi: data.chi_tiet_vu_an?.hanh_vi || '',
                    hinh_phat: data.phap_ly?.hinh_phat || '',
                    dieu_luat: data.phap_ly?.dieu_luat_day_du || '',
                    an_treo: data.phap_ly?.an_treo || false,
                });
            }
        });

        // Shuffle ngẫu nhiên (Fisher-Yates)
        for (let i = allJudgments.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allJudgments[i], allJudgments[j]] = [allJudgments[j], allJudgments[i]];
        }

        // Trả về N bản án đầu tiên sau khi shuffle
        const result = allJudgments.slice(0, Math.min(limit, allJudgments.length));

        console.log(`📋 [Random Judgments] Trả về ${result.length}/${allJudgments.length} bản án.`);
        res.json({ judgments: result });
    } catch (error) {
        console.error('❌ Lỗi getRandomJudgments:', error.message);
        res.status(500).json({
            error: 'Không thể tải danh sách bản án',
            message: error.message,
        });
    }
};

module.exports = { getRandomJudgments };
