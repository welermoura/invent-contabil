// public/notifications-sw.js
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/logo.png', // Ensure this exists or use a default
            badge: '/logo.png',
            data: {
                click_action: data.click_action,
                item_id: data.item_id
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );

        // Broadcast to window clients to update UI
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'PUSH_NOTIFICATION',
                    payload: data
                });
            });
        });
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    if (event.notification.data && event.notification.data.click_action) {
        event.waitUntil(
            clients.matchAll({type: 'window'}).then(function(clientList) {
                // Check if a tab is already open
                for (var i = 0; i < clientList.length; i++) {
                    var client = clientList[i];
                    if (client.url.includes(event.notification.data.click_action) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.click_action);
                }
            })
        );
    }
});
