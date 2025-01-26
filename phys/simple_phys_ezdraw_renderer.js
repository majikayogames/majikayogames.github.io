// Physics Renderer using EZDraw

const PhysRenderer = {
    // Color management
    colors: {
        staticBody: "#A7B5B9",     // Soft gray
        outline: "#2F3437",        // Dark gray outline
        selected: "#FF9E9E",       // Soft red
        constraint: "#4A5559",     // Dark gray for constraints
        constraintPoint: "#2F3437" // Slightly darker for constraint points
    },

    // Store assigned colors for dynamic bodies
    _objectColors: new WeakMap(),
    
    // Counter for deterministic color assignment
    _objectCounter: 0,
    
    // Pastel color palette for dynamic bodies
    _palette: [
        "#FFB3BA", // pink
        "#BAFFC9", // mint
        "#BAE1FF", // light blue
        "#FFFFBA", // light yellow
        "#FFB5E8", // pastel pink
        "#B5FFCE", // pastel green
        "#B5B9FF", // pastel blue
        "#F3FFB5", // pastel yellow
        "#FFC9DE", // rose
        "#C9FFF7", // aqua
        "#C5A3FF", // lavender
        "#FFE5A3"  // peach
    ],

    // Add to existing properties
    _mouseConstraint: null,
    _mouseObject: null,
    _mousePos: vec2(0, 0),

    // Get or assign a color for an object
    _getObjectColor(obj) {
        if (obj.isStatic) return this.colors.staticBody
        
        let color = this._objectColors.get(obj)
        if (!color) {
            const hash = Math.abs(Math.floor(
                (obj.pos.x * 1000) + 
                (obj.pos.y * 2000) + 
                this._objectCounter++
            ))
            color = this._palette[hash % this._palette.length]
            this._objectColors.set(obj, color)
        }
        return color
    },

    // Reset the renderer state
    reset() {
        this._objectCounter = 0
        this._objectColors = new WeakMap()
    },

    // Add after reset() method
    initMouseControls(world) {
        this.world = world
        
        ez.onMouseMove(() => {
            this._mousePos = ez.getMousePosWorld()
        })
        
        ez.onMouseDown(() => {
            // TODO: Replace with proper hover detection
            const hoveredObject = this._findHoveredObject()
            if (hoveredObject) {
                this._grabObject(hoveredObject)
            }
        })
        
        ez.onMouseUp(() => {
            this._releaseObject()
        })
    },
    
    // Temporary hover detection (to be replaced)
    _findHoveredObject() {
        // Find the first object that contains the mouse position
        return this.world.objects.find(obj => 
            !obj.isStatic && obj.containsPoint(this._mousePos)
        )
    },
    
    _grabObject(obj) {
        this._mouseObject = obj
        
        // Create a static anchor point at mouse position
        const mouseAnchor = new PhysObject(
            this._mousePos.x, 
            this._mousePos.y,
            0.1, 0.1,  // Small size
            true       // Static
        )
        
        // Create distance constraint between mouse and object
        this._mouseConstraint = this.world.addConstraintAtPoint(
            mouseAnchor,
            obj,
            this._mousePos,
            0,          // Zero distance
            0.5         // Lower stiffness for smoother dragging
        )
    },
    
    _releaseObject() {
        if (this._mouseConstraint) {
            // Remove constraint from world
            const index = this.world.constraints.indexOf(this._mouseConstraint)
            if (index !== -1) {
                this.world.constraints.splice(index, 1)
            }
            
            this._mouseConstraint = null
            this._mouseObject = null
        }
    },

    // Update mouse anchor position in render loop
    update() {
        if (this._mouseConstraint) {
            // Update the static anchor point position
            this._mouseConstraint.objA.pos = this._mousePos
        }
    },

    render(world) {
        if (!world || !world.objects) return

        ez.save()

        // Update mouse interaction before rendering
        this.update()

        // First render all constraints
        if (world.constraints) {
            for (const constraint of world.constraints) {
                this.renderConstraint(constraint)
            }
        }

        // Then render all objects (so they appear on top of constraints)
        for (const obj of world.objects) {
            this.renderObject(obj)
        }

        ez.restore()
    },

    renderObject(obj) {
        const fillColor = this._getObjectColor(obj)

        const rect = ez.rect(
            obj.pos,                    // position
            [obj.width, obj.height],    // size
            obj.rotation               // rotation
        )

        rect.fillAndStroke(fillColor + "EE", this.colors.outline)
    },

    renderConstraint(constraint) {
        // Calculate actual world positions of constraint attachment points
        const worldPosA = constraint.objA.isStatic ? 
            vec2(constraint.objA.pos).add(constraint.localA) : 
            constraint.objA.localToWorld(constraint.localA)
            
        const worldPosB = constraint.objB.isStatic ? 
            vec2(constraint.objB.pos).add(constraint.localB) : 
            constraint.objB.localToWorld(constraint.localB)

        const pointSize = 0.015  // Size of constraint point indicators
        ez.ctx.lineWidth = 2

        if (constraint.distance === 0) {
            // Single point for zero-distance constraints (revolute joints)
            ez.circle(worldPosA, pointSize)
                .fillAndStroke(this.colors.constraintPoint, this.colors.outline)
        } else {
            // Line with points at ends for distance constraints
            ez.line(worldPosA, worldPosB)
                .stroke(this.colors.constraint)
            
            // Draw points at both attachment locations
            ez.circle(worldPosA, pointSize)
                .fillAndStroke(this.colors.constraintPoint, this.colors.outline)
            ez.circle(worldPosB, pointSize)
                .fillAndStroke(this.colors.constraintPoint, this.colors.outline)
        }
        
        ez.ctx.lineWidth = 1
    },

    // Debug visualization methods
    drawBoundingBox(obj) {
        ez.rect(
            obj.pos,
            [obj.width, obj.height],
            obj.rotation
        ).stroke("#98FF98") // Light green for debug
    }
}
