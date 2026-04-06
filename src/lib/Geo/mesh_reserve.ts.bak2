import * as THREE from 'three'

interface Color { r: number; g: number; b: number; }

const TILE_WIDTH = 0.275;
const TILE_LENGTH = 0.5;
const OUTLINE = 0.025;

// Helper functions
const fmod = (x: number, y: number): number => {
    return x >= 0 ? x % y : (x % y) + y;
};

const lerp = (a: number, b: number, t: number): number => {
    return a + (b - a) * t;
};

const createCircle = (
    center: THREE.Vector3,
    radius: number,
    color: Color,
    vertices: number[],
    faces: number[],
    colors: number[],
    resolution: number = 32
) => {
    if (resolution <= 0) resolution = 32;

    const centerIndex = vertices.length / 3;

    // Add center vertex
    vertices.push(center.x, center.y, center.z);
    colors.push(color.r, color.g, color.b);

    // Add circle vertices
    for (let i = 0; i < resolution; i++) {
        const angle = (2 * Math.PI * i) / resolution;
        const x = Math.cos(angle) * radius + center.x;
        const y = Math.sin(angle) * radius + center.y;
        vertices.push(x, y, center.z);
        colors.push(color.r, color.g, color.b);
    }

    // Add triangles
    for (let i = 1; i < resolution; i++) {
        faces.push(centerIndex, centerIndex + i, centerIndex + i + 1);
    }

    // Close the circle
    faces.push(centerIndex, centerIndex + resolution, centerIndex + 1);
};

interface MeshData { vertices: number[]; faces: number[]; colors: number[]; }

const createGemsMesh = (
    startAngle: number,
    endAngle: number,
    length: number,
    width: number,
    outline: number
): MeshData => {
    const vertices: number[] = [];
    const faces: number[] = [];
    const colors: number[] = [];

    const m11 = Math.cos((startAngle / 180) * Math.PI);
    const m12 = Math.sin((startAngle / 180) * Math.PI);
    const m21 = Math.cos((endAngle / 180) * Math.PI);
    const m22 = Math.sin((endAngle / 180) * Math.PI);

    const blackColor: Color = { r: 0, g: 0, b: 0 };
    const whiteColor: Color = { r: 1, g: 1, b: 1 };

    // Create hexagon outline (6 vertices at 60-degree intervals)
    const hexRadius = width;
    const hexOutlineRadius = hexRadius + outline;

    // Outer hexagon (black outline)
    {
        const count = vertices.length / 3;
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i; // 60 degrees
            const x = Math.cos(angle) * hexOutlineRadius;
            const y = Math.sin(angle) * hexOutlineRadius;
            vertices.push(x, y, 0);
            colors.push(blackColor.r, blackColor.g, blackColor.b);
        }

        // Create triangles for hexagon
        for (let i = 0; i < 6; i++) {
            const next = (i + 1) % 6;
            faces.push(count, count + i, count + next);
        }
    }

    // Inner hexagon (white)
    {
        const count = vertices.length / 3;
        const hexInnerRadius = hexRadius - outline;
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = Math.cos(angle) * hexInnerRadius;
            const y = Math.sin(angle) * hexInnerRadius;
            vertices.push(x, y, 0);
            colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
        }

        // Create triangles for inner hexagon
        for (let i = 0; i < 6; i++) {
            const next = (i + 1) % 6;
            faces.push(count, count + i, count + next);
        }
    }

    // Add end caps for outline (connecting to tile direction)
    {
        const count = vertices.length / 3;
        vertices.push(
            length * m11 + width * m12, length * m12 - width * m11, 0,
            length * m11 - width * m12, length * m12 + width * m11, 0,
            -width * m12, width * m11, 0,
            width * m12, -width * m11, 0,
            length * m21 + width * m22, length * m22 - width * m21, 0,
            length * m21 - width * m22, length * m22 + width * m21, 0,
            -width * m22, width * m21, 0,
            width * m22, -width * m21, 0
        );

        for (let i = 0; i < 8; i++) {
            colors.push(blackColor.r, blackColor.g, blackColor.b);
        }

        faces.push(count, count + 1, count + 2);
        faces.push(count + 2, count + 3, count);
        faces.push(count + 4, count + 5, count + 6);
        faces.push(count + 6, count + 7, count + 4);
    }

    // Add end caps for inner part
    {
        const count = vertices.length / 3;
        const innerLength = length - outline;
        const innerWidth = width - outline;
        vertices.push(
            innerLength * m11 + innerWidth * m12, innerLength * m12 - innerWidth * m11, 0,
            innerLength * m11 - innerWidth * m12, innerLength * m12 + innerWidth * m11, 0,
            -innerWidth * m12, innerWidth * m11, 0,
            innerWidth * m12, -innerWidth * m11, 0,
            innerLength * m21 + innerWidth * m22, innerLength * m22 - innerWidth * m21, 0,
            innerLength * m21 - innerWidth * m22, innerLength * m22 + innerWidth * m21, 0,
            -innerWidth * m22, innerWidth * m21, 0,
            innerWidth * m22, -innerWidth * m21, 0
        );

        for (let i = 0; i < 8; i++) {
            colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
        }

        faces.push(count, count + 1, count + 2);
        faces.push(count + 2, count + 3, count);
        faces.push(count + 4, count + 5, count + 6);
        faces.push(count + 6, count + 7, count + 4);
    }

    return { vertices, faces, colors };
};

const createTrackMesh = (
    startAngle: number,
    endAngle: number,
    isMidspin: boolean = false,
    length: number = TILE_LENGTH,
    width: number = TILE_WIDTH,
    outline: number = OUTLINE,
    trackStyle: string = "Standard"
): MeshData => {
    if (isMidspin) {
        return createMidSpinMesh(startAngle);
    }

    // For Gems track style, generate hexagon geometry
    if (trackStyle === "Gems") {
        return createGemsMesh(startAngle, endAngle, length, width, outline);
    }

    // For Minimal track style, reduce length by 0.03 (matches ADOFAI SetTrackStyle logic)
    // num2 /= this.lengthMult; num2 -= 0.03f; num2 *= this.lengthMult;
    let adjustedLength = length;
    if (trackStyle === "Minimal") {
        adjustedLength -= 0.03;
    }

    return createTileMesh(startAngle, endAngle, adjustedLength, width, outline);
};

const createMidSpinMesh = (
    angle: number,
    width: number = TILE_WIDTH,
    length: number = TILE_WIDTH,
    outline: number = OUTLINE
): MeshData => {
    let widthi = width;
    let lengthi = length;

    const m1 = Math.cos((angle / 180) * Math.PI);
    const m2 = Math.sin((angle / 180) * Math.PI);

    const vertices: number[] = [];
    const faces: number[] = [];
    const colors: number[] = [];

    const midpoint = new THREE.Vector3(-m1 * 0.04, -m2 * 0.04, 0);

    const blackColor: Color = { r: 0, g: 0, b: 0 };
    const whiteColor: Color = { r: 1, g: 1, b: 1 };

    // Main body with outline
    widthi += outline;
    lengthi += outline;

    {
        const count = vertices.length / 3;
        vertices.push(
            midpoint.x + lengthi * m1 + widthi * m2, midpoint.y + lengthi * m2 - widthi * m1, 0,
            midpoint.x + lengthi * m1 - widthi * m2, midpoint.y + lengthi * m2 + widthi * m1, 0,
            midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0,
            midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
            midpoint.x - widthi * m1, midpoint.y - widthi * m2, 0,
            midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
            midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0
        );

        for (let i = 0; i < 7; i++) {
            colors.push(blackColor.r, blackColor.g, blackColor.b);
        }

        faces.push(count, count + 1, count + 2);
        faces.push(count + 2, count + 3, count);
        faces.push(count + 4, count + 5, count + 6);
    }

    // Inner part (white)
    widthi -= outline * 2;
    lengthi -= outline * 2;

    {
        const count = vertices.length / 3;
        vertices.push(
            midpoint.x + lengthi * m1 + widthi * m2, midpoint.y + lengthi * m2 - widthi * m1, 0,
            midpoint.x + lengthi * m1 - widthi * m2, midpoint.y + lengthi * m2 + widthi * m1, 0,
            midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0,
            midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
            midpoint.x - widthi * m1, midpoint.y - widthi * m2, 0,
            midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
            midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0
        );

        for (let i = 0; i < 7; i++) {
            colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
        }

        faces.push(count, count + 1, count + 2);
        faces.push(count + 2, count + 3, count);
        faces.push(count + 4, count + 5, count + 6);
    }

    return { vertices, faces, colors };
};

const createTileMesh = (
    startAngle: number,
    endAngle: number,
    length: number,
    width: number,
    outline: number
): MeshData => {
    const vertices: number[] = [];
    const faces: number[] = [];
    const colors: number[] = [];

    // Basic processing - same as Floor.cs CreateFloorPolygon
    const m11 = Math.cos((startAngle / 180) * Math.PI);
    const m12 = Math.sin((startAngle / 180) * Math.PI);
    const m21 = Math.cos((endAngle / 180) * Math.PI);
    const m22 = Math.sin((endAngle / 180) * Math.PI);

    const a: number[] = [0, 0];

    if (fmod(startAngle - endAngle, 360) >= fmod(endAngle - startAngle, 360)) {
        a[0] = (fmod(startAngle, 360) * Math.PI) / 180;
        a[1] = a[0] + (fmod(endAngle - startAngle, 360) * Math.PI) / 180;
    } else {
        a[0] = (fmod(endAngle, 360) * Math.PI) / 180;
        a[1] = a[0] + (fmod(startAngle - endAngle, 360) * Math.PI) / 180;
    }

    const angle = a[1] - a[0];
    const mid = a[0] + angle / 2;

    const blackColor: Color = { r: 0, g: 0, b: 0 };
    const whiteColor: Color = { r: 1, g: 1, b: 1 };

    if (angle < 2.0943952 && angle > 0) {
        // Small angle case - same as Floor.cs
        let x: number;
        if (angle < 0.08726646) {
            x = 1;
        } else if (angle < 0.5235988) {
            x = lerp(1, 0.83, Math.pow((angle - 0.08726646) / 0.43633235, 0.5));
        } else if (angle < 0.7853982) {
            x = lerp(0.83, 0.77, Math.pow((angle - 0.5235988) / 0.2617994, 1));
        } else if (angle < 1.5707964) {
            x = lerp(0.77, 0.15, Math.pow((angle - 0.7853982) / 0.7853982, 0.7));
        } else {
            x = lerp(0.15, 0, Math.pow((angle - 1.5707964) / 0.5235988, 0.5));
        }

        let distance: number, radius: number;
        if (x === 1) {
            distance = 0;
            radius = width;
        } else {
            radius = lerp(0, width, x);
            distance = (width - radius) / Math.sin(angle / 2);
        }

        let circlex = -distance * Math.cos(mid);
        let circley = -distance * Math.sin(mid);

        // Create outline (black)
        width += outline;
        length += outline;
        radius += outline;

        createCircle(new THREE.Vector3(circlex, circley, 0), radius, blackColor, vertices, faces, colors);

        // Add connecting geometry for outline - same as Floor.cs
        {
            const count = vertices.length / 3;
            vertices.push(
                -radius * Math.sin(a[1]) + circlex, radius * Math.cos(a[1]) + circley, 0,
                circlex, circley, 0,
                radius * Math.sin(a[0]) + circlex, -radius * Math.cos(a[0]) + circley, 0,
                width * Math.sin(a[0]), -width * Math.cos(a[0]), 0,
                0, 0, 0,
                -width * Math.sin(a[1]), width * Math.cos(a[1]), 0
            );

            for (let i = 0; i < 6; i++) {
                colors.push(blackColor.r, blackColor.g, blackColor.b);
            }

            faces.push(count, count + 1, count + 5);
            faces.push(count + 4, count + 1, count + 5);
            faces.push(count + 2, count + 3, count + 4);
            faces.push(count + 1, count + 3, count + 4);
        }

        // Add end caps for outline
        {
            const count = vertices.length / 3;
            vertices.push(
                length * m11 + width * m12, length * m12 - width * m11, 0,
                length * m11 - width * m12, length * m12 + width * m11, 0,
                -width * m12, width * m11, 0,
                width * m12, -width * m11, 0,
                length * m21 + width * m22, length * m22 - width * m21, 0,
                length * m21 - width * m22, length * m22 + width * m21, 0,
                -width * m22, width * m21, 0,
                width * m22, -width * m21, 0
            );

            for (let i = 0; i < 8; i++) {
                colors.push(blackColor.r, blackColor.g, blackColor.b);
            }

            faces.push(count, count + 1, count + 2);
            faces.push(count + 2, count + 3, count);
            faces.push(count + 4, count + 5, count + 6);
            faces.push(count + 6, count + 7, count + 4);
        }

        // Create inner part (white)
        width -= outline * 2;
        length -= outline * 2;
        radius -= outline * 2;

        if (radius < 0) {
            radius = 0;
            circlex = (-width / Math.sin(angle / 2)) * Math.cos(mid);
            circley = (-width / Math.sin(angle / 2)) * Math.sin(mid);
        }

        createCircle(new THREE.Vector3(circlex, circley, 0), radius, whiteColor, vertices, faces, colors);

        // Add connecting geometry for inner part
        {
            const count = vertices.length / 3;
            vertices.push(
                -radius * Math.sin(a[1]) + circlex, radius * Math.cos(a[1]) + circley, 0,
                circlex, circley, 0,
                radius * Math.sin(a[0]) + circlex, -radius * Math.cos(a[0]) + circley, 0,
                width * Math.sin(a[0]), -width * Math.cos(a[0]), 0,
                0, 0, 0,
                -width * Math.sin(a[1]), width * Math.cos(a[1]), 0
            );

            for (let i = 0; i < 6; i++) {
                colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
            }

            faces.push(count, count + 1, count + 5);
            faces.push(count + 4, count + 1, count + 5);
            faces.push(count + 2, count + 3, count + 4);
            faces.push(count + 1, count + 3, count + 4);
        }

        // Add end caps for inner part
        {
            const count = vertices.length / 3;
            vertices.push(
                length * m11 + width * m12, length * m12 - width * m11, 0,
                length * m11 - width * m12, length * m12 + width * m11, 0,
                -width * m12, width * m11, 0,
                width * m12, -width * m11, 0,
                length * m21 + width * m22, length * m22 - width * m21, 0,
                length * m21 - width * m22, length * m22 + width * m21, 0,
                -width * m22, width * m21, 0,
                width * m22, -width * m21, 0
            );

            for (let i = 0; i < 8; i++) {
                colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
            }

            faces.push(count, count + 1, count + 2);
            faces.push(count + 2, count + 3, count);
            faces.push(count + 4, count + 5, count + 6);
            faces.push(count + 6, count + 7, count + 4);
        }

    } else if (angle > 0) {
        // Normal case - same as Floor.cs
        width += outline;
        length += outline;

        let circlex = (-width / Math.sin(angle / 2)) * Math.cos(mid);
        let circley = (-width / Math.sin(angle / 2)) * Math.sin(mid);

        // Create outline
        {
            const count = vertices.length / 3;
            vertices.push(
                circlex, circley, 0,
                width * Math.sin(a[0]), -width * Math.cos(a[0]), 0,
                0, 0, 0,
                -width * Math.sin(a[1]), width * Math.cos(a[1]), 0
            );

            for (let i = 0; i < 4; i++) {
                colors.push(blackColor.r, blackColor.g, blackColor.b);
            }

            faces.push(count, count + 1, count + 2);
            faces.push(count + 2, count + 3, count);
        }

        // Add end caps for outline
        {
            const count = vertices.length / 3;
            vertices.push(
                length * m11 + width * m12, length * m12 - width * m11, 0,
                length * m11 - width * m12, length * m12 + width * m11, 0,
                -width * m12, width * m11, 0,
                width * m12, -width * m11, 0,
                length * m21 + width * m22, length * m22 - width * m21, 0,
                length * m21 - width * m22, length * m22 + width * m21, 0,
                -width * m22, width * m21, 0,
                width * m22, -width * m21, 0
            );

            for (let i = 0; i < 8; i++) {
                colors.push(blackColor.r, blackColor.g, blackColor.b);
            }

            faces.push(count, count + 1, count + 2);
            faces.push(count + 2, count + 3, count);
            faces.push(count + 4, count + 5, count + 6);
            faces.push(count + 6, count + 7, count + 4);
        }

        // Create inner part (white)
        width -= outline * 2;
        length -= outline * 2;

        circlex = (-width / Math.sin(angle / 2)) * Math.cos(mid);
        circley = (-width / Math.sin(angle / 2)) * Math.sin(mid);

        {
            const count = vertices.length / 3;
            vertices.push(
                circlex, circley, 0,
                width * Math.sin(a[0]), -width * Math.cos(a[0]), 0,
                0, 0, 0,
                -width * Math.sin(a[1]), width * Math.cos(a[1]), 0
            );

            for (let i = 0; i < 4; i++) {
                colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
            }

            faces.push(count, count + 1, count + 2);
            faces.push(count + 2, count + 3, count);
        }

        // Add end caps for inner part
        {
            const count = vertices.length / 3;
            vertices.push(
                length * m11 + width * m12, length * m12 - width * m11, 0,
                length * m11 - width * m12, length * m12 + width * m11, 0,
                -width * m12, width * m11, 0,
                width * m12, -width * m11, 0,
                length * m21 + width * m22, length * m22 - width * m21, 0,
                length * m21 - width * m22, length * m22 + width * m21, 0,
                -width * m22, width * m21, 0,
                width * m22, -width * m21, 0
            );

            for (let i = 0; i < 8; i++) {
                colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
            }

            faces.push(count, count + 1, count + 2);
            faces.push(count + 2, count + 3, count);
            faces.push(count + 4, count + 5, count + 6);
            faces.push(count + 6, count + 7, count + 4);
        }
    } else {
        // 180 degree case - same as Floor.cs
        length = width;
        width += outline;
        length += outline;

        const midpoint = new THREE.Vector3(-m11 * 0.04, -m12 * 0.04, 0);

        // Create semicircle (main body)
        createCircle(midpoint, width, blackColor, vertices, faces, colors);

        {
            const count = vertices.length / 3;
            vertices.push(
                midpoint.x + length * m11 + width * m12, midpoint.y + length * m12 - width * m11, 0,
                midpoint.x + length * m11 - width * m12, midpoint.y + length * m12 + width * m11, 0,
                midpoint.x - width * m12, midpoint.y + width * m11, 0,
                midpoint.x + width * m12, midpoint.y - width * m11, 0
            );

            for (let i = 0; i < 4; i++) {
                colors.push(blackColor.r, blackColor.g, blackColor.b);
            }

            faces.push(count, count + 1, count + 2);
            faces.push(count + 2, count + 3, count);
        }

        // Inner part (white)
        width -= outline * 2;
        length -= outline * 2;

        createCircle(midpoint, width, whiteColor, vertices, faces, colors);

        {
            const count = vertices.length / 3;
            vertices.push(
                midpoint.x + length * m11 + width * m12, midpoint.y + length * m12 - width * m11, 0,
                midpoint.x + length * m11 - width * m12, midpoint.y + length * m12 + width * m11, 0,
                midpoint.x - width * m12, midpoint.y + width * m11, 0,
                midpoint.x + width * m12, midpoint.y - width * m11, 0
            );

            for (let i = 0; i < 4; i++) {
                colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
            }

            faces.push(count, count + 1, count + 2);
            faces.push(count + 2, count + 3, count);
        }
    }

    return { vertices, faces, colors };
};


// Export interface and functions
export { fmod, lerp, createCircle, createMidSpinMesh, createTileMesh, createGemsMesh };
export type { MeshData };
export default createTrackMesh;
