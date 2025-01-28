// Simple 2D Physics Engine

class PhysObject {
    constructor(x, y, width, height, isStatic = false) {
        this.pos = vec2(x, y)
        this.vel = vec2(0, 0)
        this.acc = vec2(0, 0)
        this.width = width
        this.height = height
        
        // Add rotational properties
        this.rotation = 0        // Current rotation in radians
        this.angularVel = 0      // Angular velocity in radians/sec
        this.torque = 0          // Angular acceleration
        
        this.isStatic = isStatic
        this.mass = isStatic ? Infinity : width * height
        // Moment of inertia for a rectangle
        this.inertia = isStatic ? Infinity : (this.mass * (width * width + height * height)) / 12
    }

    step(dt) {
        if (this.isStatic) return

        // Linear motion
        this.vel = this.vel.add(this.acc.scaled(dt))
        this.pos = this.pos.add(this.vel.scaled(dt))
        
        // Angular motion
        this.angularVel += this.torque * dt / this.inertia
        this.rotation += this.angularVel * dt
        
        // Reset forces and torque
        this.acc = vec2(0, 0)
        this.torque = 0
    }

    applyForce(force, worldPoint = null) {
        if (this.isStatic) return
        
        // Apply linear force
        this.acc = this.acc.add(force.scaled(1/this.mass))
        
        // Apply torque if force is not at center of mass
        if (worldPoint) {
            const r = worldPoint.sub(this.pos)
            this.torque += r.perpendicular_dot(force)
        }
    }

    // Get world position of a local point
    localToWorld(localPoint) {
        return this.pos.add(localPoint.rotated(this.rotation))
    }

    // Get local position of a world point
    worldToLocal(worldPoint) {
        return worldPoint.sub(this.pos).rotated(-this.rotation)
    }

    // Check if a world point is inside this box
    containsPoint(worldPoint) {
        // Convert world point to local coordinates
        const localPoint = this.worldToLocal(worldPoint)
        
        // In local space, we can treat this as an AABB check
        const halfWidth = this.width / 2
        const halfHeight = this.height / 2
        
        return (
            localPoint.x >= -halfWidth &&
            localPoint.x <= halfWidth &&
            localPoint.y >= -halfHeight &&
            localPoint.y <= halfHeight
        )
    }
}

class DistanceConstraint {
    constructor(objA, objB, distance, stiffness = 1, localA = null, localB = null) {
        this.objA = objA
        this.objB = objB
        this.distance = distance
        this.stiffness = stiffness
        this.localA = localA || vec2(0, 0)
        this.localB = localB || vec2(0, 0)
        this.beta = 0.1  // Baumgarte stabilization factor
    }

    calculateConstraint() {
        // Get world positions of constraint attachment points
        const worldA = this.objA.localToWorld ? 
            this.objA.localToWorld(this.localA) : 
            this.objA.pos.add(this.localA)
            
        const worldB = this.objB.localToWorld ? 
            this.objB.localToWorld(this.localB) : 
            this.objB.pos.add(this.localB)
        
        const delta = worldB.sub(worldA)
        const currentDist = delta.length()
        if (currentDist < 0.000001) return null

        // Calculate constraint violation
        const C = currentDist - this.distance
        
        // Calculate velocities at constraint points
        const rA = this.localA.rotated(this.objA.rotation || 0)
        const rB = this.localB.rotated(this.objB.rotation || 0)
        const velA = this.objA.vel ? this.objA.vel.add(vec2(-rA.y, rA.x).scaled(this.objA.angularVel)) : vec2(0, 0)
        const velB = this.objB.vel ? this.objB.vel.add(vec2(-rB.y, rB.x).scaled(this.objB.angularVel)) : vec2(0, 0)
        const relVel = velB.sub(velA)
        
        const normal = delta.normalized()//delta.scaled(1/currentDist)
        
        return { worldA, worldB, rA, rB, normal, C, relVel, currentDist }
    }

    calculateImpulse(constraintData, dt, useBaumgarte = true) {
        const { normal, C, relVel, rA, rB } = constraintData
        
        // Calculate inverse masses and inertias
        const invMassA = this.objA.isStatic ? 0 : 1/this.objA.mass
        const invMassB = this.objB.isStatic ? 0 : 1/this.objB.mass
        const invIA = this.objA.isStatic ? 0 : 1/this.objA.inertia
        const invIB = this.objB.isStatic ? 0 : 1/this.objB.inertia
        
        // Calculate effective mass
        const rACrossN = rA.perpendicular_dot(normal)
        const rBCrossN = rB.perpendicular_dot(normal)
        const K = invMassA + invMassB + 
                 invIA * rACrossN * rACrossN +
                 invIB * rBCrossN * rBCrossN
        
        if (K < 0.000001) return null

        // Calculate impulse magnitude with optional Baumgarte stabilization:
        // When we solve the constraint for just relative velocity = 0 or C' = 0, positional errors slowly accumulate causing the chain to sag.
        // Because we are only looking at C' = 0, or the relative velocity of the constraint points, once they drift a little, they will stay apart forever.
        // To fix this, we can add a small time dependent bias value to the velocity error.
        // This will cause the velocity we apply to the constraint points to be a little bit larger than the velocity error,
        // making the constraint points overcorrect and drift back towards the starting position.
        const bias = useBaumgarte ? ((this.beta/dt) * C) : 0
        const Jv = normal.dot(relVel)
        const lambda = -(Jv + bias) / K
        
        return {
            impulse: normal.scaled(lambda * this.stiffness),
            invMassA,
            invMassB,
            invIA,
            invIB,
            rA,
            rB
        }
    }

    // Apply calculated impulse
    applyImpulse(impulseData) {
        const { impulse, invMassA, invMassB, invIA, invIB, rA, rB } = impulseData
        
        if (!this.objA.isStatic && this.objA.vel) {
            this.objA.vel = this.objA.vel.sub(impulse.scaled(invMassA))
            this.objA.angularVel -= invIA * rA.perpendicular_dot(impulse)
        }
        
        if (!this.objB.isStatic && this.objB.vel) {
            this.objB.vel = this.objB.vel.add(impulse.scaled(invMassB))
            this.objB.angularVel += invIB * rB.perpendicular_dot(impulse)
        }
    }
}

class ContactConstraint {
    constructor(objA, objB, contactPoint, normal, restitution = 0.2) {
        this.objA = objA
        this.objB = objB
        // Convert contact point to local coordinates for both objects
        this.localA = objA.worldToLocal(contactPoint)
        this.localB = objB.worldToLocal(contactPoint)
        this.normal = normal  // Points from A to B
        this.restitution = restitution
        this.beta = 0.2  // Baumgarte stabilization factor
    }

    calculateConstraint() {
        // Get world positions of constraint attachment points
        const worldA = this.objA.localToWorld(this.localA)
        const worldB = this.objB.localToWorld(this.localB)
        
        // Calculate penetration depth (negative means penetrating)
        const delta = worldB.sub(worldA)
        const C = delta.dot(this.normal)
        
        // If not penetrating, no constraint needed
        if (C > 0) return null
        
        // Calculate velocities at contact points
        const rA = this.localA.rotated(this.objA.rotation)
        const rB = this.localB.rotated(this.objB.rotation)
        const velA = this.objA.vel.add(vec2(-rA.y, rA.x).scaled(this.objA.angularVel))
        const velB = this.objB.vel.add(vec2(-rB.y, rB.x).scaled(this.objB.angularVel))
        const relVel = velB.sub(velA)
        
        return { worldA, worldB, rA, rB, normal: this.normal, C, relVel }
    }

    calculateImpulse(constraintData, dt, useBaumgarte = true) {
        const { normal, C, relVel, rA, rB } = constraintData
        
        // Calculate inverse masses and inertias
        const invMassA = this.objA.isStatic ? 0 : 1/this.objA.mass
        const invMassB = this.objB.isStatic ? 0 : 1/this.objB.mass
        const invIA = this.objA.isStatic ? 0 : 1/this.objA.inertia
        const invIB = this.objB.isStatic ? 0 : 1/this.objB.inertia
        
        // Calculate effective mass
        const rACrossN = rA.perpendicular_dot(normal)
        const rBCrossN = rB.perpendicular_dot(normal)
        const K = invMassA + invMassB + 
                 invIA * rACrossN * rACrossN +
                 invIB * rBCrossN * rBCrossN
        
        if (K < 0.000001) return null

        // Calculate relative velocity along normal
        const Jv = normal.dot(relVel)
        
        // Calculate bias term (Baumgarte stabilization)
        const bias = useBaumgarte ? (this.beta/dt) * Math.min(0, C) : 0
        
        // Add restitution impulse when objects are separating
        const restitutionTerm = (Jv < -1) ? -this.restitution * Jv : 0
        
        // Calculate impulse magnitude
        const lambda = -(Jv + bias + restitutionTerm) / K
        
        // Clamp to ensure we only push objects apart, never pull them together
        if (lambda < 0) return null
        
        return {
            impulse: normal.scaled(lambda),
            invMassA,
            invMassB,
            invIA,
            invIB,
            rA,
            rB
        }
    }

    applyImpulse(impulseData) {
        const { impulse, invMassA, invMassB, invIA, invIB, rA, rB } = impulseData
        
        if (!this.objA.isStatic) {
            this.objA.vel = this.objA.vel.sub(impulse.scaled(invMassA))
            this.objA.angularVel -= invIA * rA.perpendicular_dot(impulse)
        }
        
        if (!this.objB.isStatic) {
            this.objB.vel = this.objB.vel.add(impulse.scaled(invMassB))
            this.objB.angularVel += invIB * rB.perpendicular_dot(impulse)
        }
    }
}

class PhysWorld {
    constructor() {
        this.objects = []
        this.constraints = []
        this.gravity = vec2(0, -9.81)
        this.constraintIterations = 10  // Increased from 10
        this.useJacobiSolver = true // over gauss-seidel
        this.dt = 1/60                 // Increased frequency
    }

    addBox(x, y, width, height) {
        const box = new PhysObject(x, y, width, height, false)
        this.objects.push(box)
        return box
    }

    addStaticBox(x, y, width, height) {
        const box = new PhysObject(x, y, width, height, true)
        this.objects.push(box)
        return box
    }

    addDistanceConstraint(objA, objB, distance, stiffness = 1, localA = null, localB = null) {
        const constraint = new DistanceConstraint(objA, objB, distance, stiffness, localA, localB)
        this.constraints.push(constraint)
        return constraint
    }

    step(dt) {
        // Split the step into multiple substeps for better stability
        const numSubsteps = 4
        const subDt = dt / numSubsteps
        
        for (let i = 0; i < numSubsteps; i++) {
            // Apply gravity and integrate
            for (let obj of this.objects) {
                if (!obj.isStatic) {
                    obj.applyForce(this.gravity.scaled(subDt/dt))
                }
            }

            // Solve constraints
            if (this.useJacobiSolver) {
                this.solveConstraintsJacobi()
            } else {
                this.solveConstraintsGaussSeidel()
            }

            // Update positions
            for (let obj of this.objects) {
                if (!obj.isStatic) {
                    obj.step(subDt)
                }
            }
        }
    }

    solveConstraintsGaussSeidel() {
        for (let i = 0; i < this.constraintIterations; i++) {
            for (let constraint of this.constraints) {
                const constraintData = constraint.calculateConstraint()
                if (!constraintData) continue
                
                const impulseData = constraint.calculateImpulse(constraintData, this.dt)
                if (!impulseData) continue
                
                constraint.applyImpulse(impulseData)
            }
        }
    }

    solveConstraintsJacobi() {
        for (let i = 0; i < this.constraintIterations; i++) {
            const impulses = this.constraints.map(constraint => {
                const constraintData = constraint.calculateConstraint()
                if (!constraintData) return null
                
                const impulseData = constraint.calculateImpulse(constraintData, this.dt)
                if (!impulseData) return null
                
                return { constraint, impulseData }
            }).filter(x => x !== null)
            
            for (const { constraint, impulseData } of impulses) {
                constraint.applyImpulse(impulseData)
            }
        }
    }

    // Utility method to create a constraint at a specific world position
    addConstraintAtPoint(objA, objB, worldPoint, distance = 0, stiffness = 1) {
        // Calculate local offsets for both objects
        const localA = objA.isStatic ? 
            worldPoint.sub(objA.pos) : 
            objA.worldToLocal(worldPoint)
            
        const localB = objB.isStatic ? 
            worldPoint.sub(objB.pos) : 
            objB.worldToLocal(worldPoint)

        return this.addDistanceConstraint(objA, objB, distance, stiffness, localA, localB)
    }

    // Utility method to create a revolute joint between two objects
    addRevoluteJoint(objA, objB, worldPoint) {
        // If objA is a simple static point, convert it to a proper static PhysObject
        if (!objA.localToWorld) {
            objA = new PhysObject(objA.pos.x, objA.pos.y, 0.1, 0.1, true)
        }
        return this.addConstraintAtPoint(objA, objB, worldPoint, 0)
    }
}
