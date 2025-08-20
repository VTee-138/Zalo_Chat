document.addEventListener('DOMContentLoaded', async () => {
    const channelList = document.getElementById('channel-list');

    try {
        const response = await fetch('/api/get-connected-oas');
        const oas = await response.json();

        channelList.innerHTML = ''; // Xóa loading text

        if (Object.keys(oas).length === 0) {
            channelList.innerHTML = `
                <div class="no-channels">
                    <p>🔗 Chưa có OA nào được kết nối</p>
                    <p>Vui lòng kết nối Official Account để bắt đầu.</p>
                    <a href="/connect/zalo" class="connect-button">Kết nối Zalo OA</a>
                </div>
            `;
            return;
        }

        for (const oa_id in oas) {
            const oa = oas[oa_id];
            const channelCard = document.createElement('div');
            channelCard.className = 'channel-card-wrapper';
            channelCard.innerHTML = `
                <a href="/chat/${oa_id}" class="channel-card">
                    <div class="channel-card-content">
                        <div class="channel-avatar">
                            <img src="https://developers.zalo.me/web/static/prod/images/zalo-logo.svg" alt="Zalo OA">
                        </div>
                        <div class="channel-info">
                            <h3>${oa.name}</h3>
                            <p>ID: ${oa_id}</p>
                            <span class="channel-type">Zalo Official Account</span>
                        </div>
                        <div class="channel-arrow">→</div>
                    </div>
                </a>
                <div class="channel-actions">
                    <button class="crawl-btn" onclick="crawlMessages('${oa_id}')">
                        📥 Crawl Tin Nhắn
                    </button>
                </div>
            `;
            channelList.appendChild(channelCard);
        }
    } catch (error) {
        console.error('Lỗi khi tải danh sách OA:', error);
        channelList.innerHTML = `
            <div class="error-message">
                <p>❌ Lỗi khi tải danh sách OA</p>
                <button onclick="location.reload()">Thử lại</button>
            </div>
        `;
    }
});

// Function để crawl tin nhắn
async function crawlMessages(oa_id) {
    const crawlBtn = document.querySelector(`button[onclick="crawlMessages('${oa_id}')"]`);
    const originalText = crawlBtn.innerHTML;
    
    // Disable button và hiển thị loading
    crawlBtn.disabled = true;
    crawlBtn.innerHTML = '🔄 Đang crawl...';
    crawlBtn.classList.add('loading');
    
    try {
        const response = await fetch(`/api/crawl-messages/${oa_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ limit: 50 }) // Crawl 50 conversations mỗi lần
        });
        
        const result = await response.json();
        
        if (result.success) {
            crawlBtn.innerHTML = '✅ Hoàn thành!';
            crawlBtn.classList.remove('loading');
            crawlBtn.classList.add('success');
            
            // Hiển thị thông báo thành công
            showNotification('Crawl tin nhắn thành công! Hãy vào chat để xem.', 'success');
            
            // Reset button sau 3 giây
            setTimeout(() => {
                crawlBtn.innerHTML = originalText;
                crawlBtn.disabled = false;
                crawlBtn.classList.remove('success');
            }, 3000);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Lỗi khi crawl tin nhắn:', error);
        crawlBtn.innerHTML = '❌ Lỗi';
        crawlBtn.classList.remove('loading');
        crawlBtn.classList.add('error');
        
        showNotification('Lỗi khi crawl tin nhắn: ' + error.message, 'error');
        
        // Reset button sau 3 giây
        setTimeout(() => {
            crawlBtn.innerHTML = originalText;
            crawlBtn.disabled = false;
            crawlBtn.classList.remove('error');
        }, 3000);
    }
}

// Function để hiển thị notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentNode.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Tự động ẩn sau 5 giây
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Expose function to global scope
window.crawlMessages = crawlMessages;