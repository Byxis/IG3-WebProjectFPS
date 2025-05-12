export class Vector3 {
    /**
     ** Creates a new Vector3 instance
     * @param {number} x - The x component (default: 0)
     * @param {number} y - The y component (default: 0)
     * @param {number} z - The z component (default: 0)
     */
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    /**
     ** Sets the vector components
     * @param {number} x - The x component
     * @param {number} y - The y component
     * @param {number} z - The z component
     * @returns {Vector3} This vector for chaining
     */
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
    /**
     ** Copies the components from another vector
     * @param {Vector3} v - Vector to copy from
     * @returns {Vector3} This vector for chaining
     */
    copy(v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }
    /**
     ** Adds another vector to this vector
     * @param {Vector3} v - Vector to add
     * @returns {Vector3} This vector for chaining
     */
    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }
    /**
     ** Adds another vector scaled by a factor to this vector
     * @param {Vector3} v - Vector to add
     * @param {number} s - Scale factor
     * @returns {Vector3} This vector for chaining
     */
    addScaledVector(v, s) {
        this.x += v.x * s;
        this.y += v.y * s;
        this.z += v.z * s;
        return this;
    }
    /**
     ** Multiplies this vector by a scalar value
     * @param {number} scalar - The scalar value
     * @returns {Vector3} This vector for chaining
     */
    multiplyScalar(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }
    /**
     ** Calculates the cross product with another vector
     * @param {Vector3} v - The vector to cross with
     * @returns {Vector3} This vector for chaining
     */
    cross(v) {
        const x = this.y * v.z - this.z * v.y;
        const y = this.z * v.x - this.x * v.z;
        const z = this.x * v.y - this.y * v.x;
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
    /**
     ** Creates a new instance with the same component values
     * @returns {Vector3} A new Vector3 with the same values
     */
    clone() {
        return new Vector3(this.x, this.y, this.z);
    }
    /**
     ** Calculates the length of this vector
     * @returns {number} The vector's length
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    /**
     ** Normalizes this vector to a length of 1
     * @returns {Vector3} This vector for chaining
     */
    normalize() {
        const length = this.length();
        if (length > 0) {
            this.x /= length;
            this.y /= length;
            this.z /= length;
        }
        return this;
    }
    /**
     ** Linearly interpolates toward another vector
     * @param {Vector3} v - Target vector
     * @param {number} alpha - Interpolation factor (0-1)
     * @returns {Vector3} This vector for chaining
     */
    lerp(v, alpha) {
        this.x += (v.x - this.x) * alpha;
        this.y += (v.y - this.y) * alpha;
        this.z += (v.z - this.z) * alpha;
        return this;
    }
    /**
     ** Creates a direction vector from Euler rotation
     * @param {Vector3} rotation - Rotation in euler angles
     * @returns {Vector3} This vector for chaining
     */
    fromEuler(rotation) {
        const x = -Math.sin(rotation.y);
        const y = 0;
        const z = -Math.cos(rotation.y);
        this.set(x, y, z).normalize();
        return this;
    }
}
