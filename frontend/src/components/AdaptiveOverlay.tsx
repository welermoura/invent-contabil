import React, { useEffect, useState } from 'react';

interface AdaptiveOverlayProps {
    imageUrl: string;
}

const AdaptiveOverlay: React.FC<AdaptiveOverlayProps> = ({ imageUrl }) => {
    // Inicialmente transparente até calcularmos
    const [overlayColor, setOverlayColor] = useState<string>('rgba(0,0,0,0)');

    useEffect(() => {
        if (!imageUrl) {
            setOverlayColor('rgba(0,0,0,0)');
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

                // Redimensionar para performance (50x50 é suficiente para média)
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

                    // Fórmula de luminância padrão
                    avg = Math.floor((r * 0.2126) + (g * 0.7152) + (b * 0.0722));
                    colorSum += avg;
                }

                const brightness = Math.floor(colorSum / (50 * 50));

                // Imagem clara -> overlay escuro
                // Imagem escura -> overlay claro
                if (brightness > 128) {
                    setOverlayColor('rgba(15, 23, 42, 0.65)');
                } else {
                    setOverlayColor('rgba(255, 255, 255, 0.88)');
                }
            } catch (e) {
                console.warn('AdaptiveOverlay: Unable to calculate brightness', e);
                // Fallback seguro: overlay escuro para garantir legibilidade
                setOverlayColor('rgba(15, 23, 42, 0.65)');
            }
        };

        img.onerror = () => {
             setOverlayColor('rgba(0,0,0,0)');
        };

    }, [imageUrl]);

    return (
        <div
            className="fixed inset-0 w-full h-full transition-colors duration-700 ease-in-out pointer-events-none"
            style={{
                backgroundColor: overlayColor,
                zIndex: 0
            }}
        />
    );
};

export default AdaptiveOverlay;
