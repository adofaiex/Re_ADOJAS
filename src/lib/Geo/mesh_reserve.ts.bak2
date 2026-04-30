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

const createTrackMesh = (
    startAngle: number,
    endAngle: number,
    isMidspin: boolean = false,
    length: number = TILE_LENGTH,
    width: number = TILE_WIDTH,
    outline: number = OUTLINE
): MeshData => {
    if (isMidspin) {
        return createMidSpinMesh(startAngle);
    }
    return createTileMesh(startAngle, endAngle, length, width, outline);
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

    // Main body with outline
    widthi += outline;
    lengthi += outline;

    let count = 0;
    const blackColor: Color = { r: 0, g: 0, b: 0 };

    // Add vertices for main body
    vertices.push(
        midpoint.x + lengthi * m1 + widthi * m2, midpoint.y + lengthi * m2 - widthi * m1, 0,
        midpoint.x + lengthi * m1 - widthi * m2, midpoint.y + lengthi * m2 + widthi * m1, 0,
        midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0,
        midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
        midpoint.x - widthi * m1, midpoint.y - widthi * m2, 0,
        midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
        midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0
    );

    // Add colors for main body
    for (let i = 0; i < 7; i++) {
        colors.push(blackColor.r, blackColor.g, blackColor.b);
    }

    // Add faces for main body
    faces.push(count, count + 1, count + 2, count + 2, count + 3, count, count + 4, count + 5, count + 6);

    // Inner part (white)
    width -= OUTLINE * 2;
    lengthi -= OUTLINE * 2;

    count = vertices.length / 3;
    const whiteColor: Color = { r: 1, g: 1, b: 1 };

    // Add vertices for inner part
    vertices.push(
        midpoint.x + lengthi * m1 + width * m2, midpoint.y + lengthi * m2 - width * m1, 0,
        midpoint.x + lengthi * m1 - width * m2, midpoint.y + lengthi * m2 + width * m1, 0,
        midpoint.x - width * m2, midpoint.y + width * m1, 0,
        midpoint.x + width * m2, midpoint.y - width * m1, 0,
        midpoint.x - width * m1, midpoint.y - width * m2, 0,
        midpoint.x + width * m2, midpoint.y - width * m1, 0,
        midpoint.x - width * m2, midpoint.y + width * m1, 0
    );

    // Add colors for inner part
    for (let i = 0; i < 7; i++) {
        colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
    }

    // Add faces for inner part
    faces.push(count, count + 1, count + 2, count + 2, count + 3, count, count + 4, count + 5, count + 6);

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

    // Basic processing
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
        // Small angle case
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

        // Create outline
        width += outline;
        length += outline;
        radius += outline;

        createCircle(new THREE.Vector3(circlex, circley, 0), radius, blackColor, vertices, faces, colors);

        // Add connecting geometry for outline
        let count = vertices.length / 3;
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

        faces.push(
            count, count + 1, count + 5, count + 4, count + 1, count + 5,
            count + 2, count + 3, count + 4, count + 1, count + 3, count + 4
        );

        // Add end caps for outline
        count = vertices.length / 3;
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

        faces.push(
            count, count + 1, count + 2, count + 2, count + 3, count,
            count + 4, count + 5, count + 6, count + 6, count + 7, count + 4
        );

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
        count = vertices.length / 3;
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

        faces.push(
            count, count + 1, count + 5, count + 4, count + 1, count + 5,
            count + 2, count + 3, count + 4, count + 1, count + 3, count + 4
        );

        // Add end caps for inner part
        count = vertices.length / 3;
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

        faces.push(
            count, count + 1, count + 2, count + 2, count + 3, count,
            count + 4, count + 5, count + 6, count + 6, count + 7, count + 4
        );

    } else if (angle > 0) {
        // Normal case
        width += outline;
        length += outline;

        const circlex = (-width / Math.sin(angle / 2)) * Math.cos(mid);
        const circley = (-width / Math.sin(angle / 2)) * Math.sin(mid);

        // Create outline
        let count = 0;
        vertices.push(
            circlex, circley, 0,
            width * Math.sin(a[0]), -width * Math.cos(a[0]), 0,
            0, 0, 0,
            -width * Math.sin(a[1]), width * Math.cos(a[1]), 0
        );

        for (let i = 0; i < 4; i++) {
            colors.push(blackColor.r, blackColor.g, blackColor.b);
        }

        faces.push(count, count + 1, count + 2, count + 2, count + 3, count);

        // Add end caps for outline
        count = vertices.length / 3;
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

        faces.push(
            count, count + 1, count + 2, count + 2, count + 3, count,
            count + 4, count + 5, count + 6, count + 6, count + 7, count + 4
        );

        // Create inner part (white)
        width -= outline * 2;
        length -= outline * 2;

        const innerCirclex = (-width / Math.sin(angle / 2)) * Math.cos(mid);
        const innerCircley = (-width / Math.sin(angle / 2)) * Math.sin(mid);

        count = vertices.length / 3;
        vertices.push(
            innerCirclex, innerCircley, 0,
            width * Math.sin(a[0]), -width * Math.cos(a[0]), 0,
            0, 0, 0,
            -width * Math.sin(a[1]), width * Math.cos(a[1]), 0
        );

        for (let i = 0; i < 4; i++) {
            colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
        }

        faces.push(count, count + 1, count + 2, count + 2, count + 3, count);

        // Add end caps for inner part
        count = vertices.length / 3;
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

        faces.push(
            count, count + 1, count + 2, count + 2, count + 3, count,
            count + 4, count + 5, count + 6, count + 6, count + 7, count + 4
        );
    }

    return { vertices, faces, colors };
};



// 导出接口和函数
interface MeshData {
  vertices: number[];
  colors: number[];
  faces: number[];
}

export { fmod, lerp, createCircle, createMidSpinMesh, createTileMesh };
export type { MeshData };
export default createTrackMesh;