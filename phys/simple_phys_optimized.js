// Optimized 2D Physics Engine

class PhysObject {
    constructor(x, y, width, height, isStatic = false) {
        this.pos = vec2(x, y);
        this.vel = vec2(0, 0);
        this.acc = vec2(0, 0);
        this.width = width;
        this.height = height;
        
        // Rotational properties
        this.rotation = 0;
        this.angularVel = 0;
        this.torque = 0;
        
        this.isStatic = isStatic;
        this.mass = isStatic ? Infinity : width * height;
        this.inertia = isStatic ? Infinity : (this.mass * (width * width + height * height)) / 12;
    }

    step(dt) {
        if (this.isStatic) return;

        // Directly update velocity and position components
        this.vel.x += this.acc.x * dt;
        this.vel.y += this.acc.y * dt;
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        
        // Angular motion
        this.angularVel += this.torque * dt / this.inertia;
        this.rotation += this.angularVel * dt;
        
        // Reset forces
        this.acc.x = this.acc.y = 0;
        this.torque = 0;
    }

    applyForce(force, worldPoint = null) {
        if (this.isStatic) return;
        
        // Directly add force components
        const invMass = 1 / this.mass;
        this.acc.x += force.x * invMass;
        this.acc.y += force.y * invMass;
        
        if (worldPoint) {
            // Calculate torque using components directly
            const rx = worldPoint.x - this.pos.x;
            const ry = worldPoint.y - this.pos.y;
            this.torque += rx * force.y - ry * force.x;
        }
    }

    localToWorld(localPoint) {
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        return vec2(
            this.pos.x + (localPoint.x * cos - localPoint.y * sin),
            this.pos.y + (localPoint.x * sin + localPoint.y * cos)
        );
    }

    worldToLocal(worldPoint) {
        const dx = worldPoint.x - this.pos.x;
        const dy = worldPoint.y - this.pos.y;
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        return vec2(
            dx * cos + dy * sin,
            -dx * sin + dy * cos
        );
    }

    containsPoint(worldPoint) {
        const local = this.worldToLocal(worldPoint);
        const hw = this.width / 2;
        const hh = this.height / 2;
        return local.x >= -hw && local.x <= hw && local.y >= -hh && local.y <= hh;
    }
}

class DistanceConstraint {
    constructor(objA, objB, distance, stiffness = 1, localA = null, localB = null) {
        this.objA = objA;
        this.objB = objB;
        this.distance = distance;
        this.stiffness = stiffness;
        this.localA = localA || vec2(0, 0);
        this.localB = localB || vec2(0, 0);
        this.beta = 0.1;
    }

    calculateConstraint() {
        // Calculate world positions using components directly
        const a = this.objA;
        const la = this.localA;
        const aCos = Math.cos(a.rotation);
        const aSin = Math.sin(a.rotation);
        const worldAX = a.pos.x + (la.x * aCos - la.y * aSin);
        const worldAY = a.pos.y + (la.x * aSin + la.y * aCos);

        const b = this.objB;
        const lb = this.localB;
        const bCos = Math.cos(b.rotation);
        const bSin = Math.sin(b.rotation);
        const worldBX = b.pos.x + (lb.x * bCos - lb.y * bSin);
        const worldBY = b.pos.y + (lb.x * bSin + lb.y * bCos);

        // Calculate delta components
        const dx = worldBX - worldAX;
        const dy = worldBY - worldAY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1e-6) return null;

        // Calculate normal components
        const invDist = 1 / dist;
        const normalX = dx * invDist;
        const normalY = dy * invDist;

        // Calculate relative velocity components
        const rAx = worldAX - a.pos.x;
        const rAy = worldAY - a.pos.y;
        const aVelX = a.vel.x - rAy * a.angularVel;
        const aVelY = a.vel.y + rAx * a.angularVel;

        const rBx = worldBX - b.pos.x;
        const rBy = worldBY - b.pos.y;
        const bVelX = b.vel.x - rBy * b.angularVel;
        const bVelY = b.vel.y + rBx * b.angularVel;

        return {
            C: dist - this.distance,
            normalX, normalY,
            rAx, rAy, rBx, rBy,
            relVelX: bVelX - aVelX,
            relVelY: bVelY - aVelY,
            currentDist: dist
        };
    }

    calculateImpulse(constraintData, dt) {
        const { normalX, normalY, C, relVelX, relVelY, rAx, rAy, rBx, rBy } = constraintData;
        
        const invMassA = this.objA.isStatic ? 0 : 1 / this.objA.mass;
        const invMassB = this.objB.isStatic ? 0 : 1 / this.objB.mass;
        const invIA = this.objA.isStatic ? 0 : 1 / this.objA.inertia;
        const invIB = this.objB.isStatic ? 0 : 1 / this.objB.inertia;

        // Cross products
        const rACrossN = rAx * normalY - rAy * normalX;
        const rBCrossN = rBx * normalY - rBy * normalX;
        const K = invMassA + invMassB + invIA * rACrossN * rACrossN + invIB * rBCrossN * rBCrossN;
        if (K < 1e-6) return null;

        const bias = this.beta / dt * C;
        const Jv = normalX * relVelX + normalY * relVelY;
        const lambda = -(Jv + bias) / K * this.stiffness;

        return {
            impulseX: normalX * lambda,
            impulseY: normalY * lambda,
            invMassA, invMassB, invIA, invIB,
            rAx, rAy, rBx, rBy
        };
    }

    applyImpulse(impulseData) {
        const { impulseX, impulseY, invMassA, invMassB, invIA, invIB, rAx, rAy, rBx, rBy } = impulseData;
        
        if (!this.objA.isStatic) {
            this.objA.vel.x -= impulseX * invMassA;
            this.objA.vel.y -= impulseY * invMassA;
            this.objA.angularVel -= invIA * (rAx * impulseY - rAy * impulseX);
        }
        
        if (!this.objB.isStatic) {
            this.objB.vel.x += impulseX * invMassB;
            this.objB.vel.y += impulseY * invMassB;
            this.objB.angularVel += invIB * (rBx * impulseY - rBy * impulseX);
        }
    }
}

class PhysWorld {
    constructor() {
        this.objects = [];
        this.constraints = [];
        this.gravity = vec2(0, -9.81);
        this.constraintIterations = 10;
        this.useJacobiSolver = true;
        this.dt = 1/60;
    }

    addBox(x, y, width, height) {
        const box = new PhysObject(x, y, width, height);
        this.objects.push(box);
        return box;
    }

    addStaticBox(x, y, width, height) {
        const box = new PhysObject(x, y, width, height, true);
        this.objects.push(box);
        return box;
    }

    addDistanceConstraint(objA, objB, distance, stiffness = 1, localA = null, localB = null) {
        const constraint = new DistanceConstraint(objA, objB, distance, stiffness, localA, localB);
        this.constraints.push(constraint);
        return constraint;
    }

    step(dt) {
        const numSubsteps = 4;
        const subDt = dt / numSubsteps;
        const gravityPerSubstep = vec2(this.gravity.x * subDt/dt, this.gravity.y * subDt/dt);

        for (let i = 0; i < numSubsteps; i++) {
            for (const obj of this.objects) {
                if (!obj.isStatic) obj.applyForce(gravityPerSubstep);
            }

            this.useJacobiSolver ? this.solveConstraintsJacobi() : this.solveConstraintsGaussSeidel();

            for (const obj of this.objects) {
                if (!obj.isStatic) obj.step(subDt);
            }
        }
    }

    solveConstraintsGaussSeidel() {
        for (let i = 0; i < this.constraintIterations; i++) {
            for (const constraint of this.constraints) {
                const data = constraint.calculateConstraint();
                if (!data) continue;
                const impulse = constraint.calculateImpulse(data, this.dt);
                if (impulse) constraint.applyImpulse(impulse);
            }
        }
    }

    solveConstraintsJacobi() {
        for (let i = 0; i < this.constraintIterations; i++) {
            const impulses = [];
            for (const constraint of this.constraints) {
                const data = constraint.calculateConstraint();
                if (!data) continue;
                const impulse = constraint.calculateImpulse(data, this.dt);
                if (impulse) impulses.push([constraint, impulse]);
            }
            for (const [constraint, impulse] of impulses) {
                constraint.applyImpulse(impulse);
            }
        }
    }

    addConstraintAtPoint(objA, objB, worldPoint, distance = 0, stiffness = 1) {
        const localA = objA.worldToLocal ? objA.worldToLocal(worldPoint) : worldPoint.sub(objA.pos);
        const localB = objB.worldToLocal ? objB.worldToLocal(worldPoint) : worldPoint.sub(objB.pos);
        return this.addDistanceConstraint(objA, objB, distance, stiffness, localA, localB);
    }

    addRevoluteJoint(objA, objB, worldPoint) {
        if (!objA.localToWorld) {
            objA = new PhysObject(objA.pos.x, objA.pos.y, 0.1, 0.1, true);
        }
        return this.addConstraintAtPoint(objA, objB, worldPoint, 0);
    }
}