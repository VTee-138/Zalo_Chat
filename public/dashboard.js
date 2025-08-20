document.addEventListener('DOMContentLoaded', async () => {
    const channelList = document.getElementById('channel-list');

    try {
        const response = await fetch('/api/get-connected-oas');
        const oas = await response.json();

        if (Object.keys(oas).length === 0) {
            channelList.innerHTML = '<p>Chưa có kênh chat nào được kết nối.</p>';
            return;
        }

        for (const oa_id in oas) {
            const oa = oas[oa_id];
            const channelCard = document.createElement('a');
            channelCard.className = 'channel-card';
            channelCard.href = `/chat/${oa_id}`; // Link đến trang chat của OA này
            channelCard.innerHTML = `
                <img src="https://developers.zalo.me/web/static/prod/images/zalo-logo.svg" alt="Zalo">
                <div>
                    <h4>${oa.name}</h4>
                    <p>Zalo Official Account</p>
                </div>
            `;
            channelList.appendChild(channelCard);
        }
    } catch (error) {
        channelList.innerHTML = '<p>Lỗi khi tải danh sách kênh.</p>';
    }
});