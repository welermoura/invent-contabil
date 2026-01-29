import React, { useEffect } from 'react';

interface AdaptiveContrastManagerProps {
    imageUrl?: string | null;
    backgroundColor?: string | null;
}

const AdaptiveContrastManager: React.FC<AdaptiveContrastManagerProps> = ({ imageUrl, backgroundColor }) => {
    useEffect(() => {
        // Priority 1: Image Analysis
        if (imageUrl) {
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
                    applyTheme(brightness);
                } catch (e) {
                    console.warn('AdaptiveContrast: Unable to calculate brightness', e);
                }
            };
            return;
        }

        // Priority 2: Solid Color Analysis
        if (backgroundColor) {
            const brightness = calculateHexBrightness(backgroundColor);
            if (brightness !== null) {
                applyTheme(brightness);
            }
            return;
        }

        // Default: Light Theme (remove dark)
        document.documentElement.classList.remove('dark');

    }, [imageUrl, backgroundColor]);

    const calculateHexBrightness = (hex: string): number | null => {
        try {
            let c = hex.substring(1);
            if (c.length === 3) {
                c = c.split('').map(char => char + char).join('');
            }
            const rgb = parseInt(c, 16);
            const r = (rgb >> 16) & 0xff;
            const g = (rgb >>  8) & 0xff;
            const b = (rgb >>  0) & 0xff;

            return Math.floor((r * 0.299) + (g * 0.587) + (b * 0.114));
        } catch (e) {
            console.error("Invalid Hex Color", e);
            return null;
        }
    }

    const applyTheme = (brightness: number) => {
        // Background Escuro (<=128) -> Modo Dark (Texto Claro)
        // Background Claro (>128) -> Modo Light (Texto Escuro)
        if (brightness <= 128) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    /* Original Image Logic removed to prevent duplication in diff context */
    /* Merged into main useEffect above */

    return null;
};

export default AdaptiveContrastManager;
