import React, { useEffect } from 'react';

interface AdaptiveContrastManagerProps {
    imageUrl: string | null;
}

const AdaptiveContrastManager: React.FC<AdaptiveContrastManagerProps> = ({ imageUrl }) => {
    useEffect(() => {
        if (!imageUrl) {
            return;
        }

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                canvas.width = 50;
                canvas.height = 50;

                ctx.drawImage(img, 0, 0, 50, 50);

                const imageData = ctx.getImageData(0, 0, 50, 50);
                const data = imageData.data;
                let r, g, b, avg;
                let colorSum = 0;

                for (let x = 0, len = data.length; x < len; x += 4) {
                    r = data[x];
                    g = data[x + 1];
                    b = data[x + 2];

                    avg = Math.floor((r * 0.2126) + (g * 0.7152) + (b * 0.0722));
                    colorSum += avg;
                }

                const brightness = Math.floor(colorSum / (50 * 50));

                // Lógica de Contraste Adaptativo:
                // Background Escuro (<=128) -> Modo Dark (Texto Claro)
                // Background Claro (>128) -> Modo Light (Texto Escuro)

                if (brightness <= 128) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            } catch (e) {
                console.warn('AdaptiveContrast: Unable to calculate brightness', e);
            }
        };

        img.onerror = () => {
             // Silently fail to default theme
        };

    }, [imageUrl]);

    return null;
};

export default AdaptiveContrastManager;
