import { Schema } from 'mongoose';
import * as bcrypt from 'bcrypt';

export const UsuarioSchema = new Schema(
    {
        correo: {
            type: String,
            required: [true, 'El correo es obligatorio'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Por favor ingrese un correo válido'],
        },
        nombre: {
            type: String,
            required: [true, 'El nombre es obligatorio'],
            trim: true,
        },
        carrera: {
            type: String,
            required: [true, 'La carrera es obligatoria'],
            trim: true,
        },
        rol: {
            type: String,
            required: [true, 'El rol es obligatorio'],
            enum: {
                values: ['docente', 'alumno', 'administrador'],
                message: 'El rol debe ser: docente, alumno o administrador',
            },
        },
        contraseña: {
            type: String,
            required: [true, 'La contraseña es obligatoria'],
            minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

// Hash de la contraseña antes de guardar
UsuarioSchema.pre('save', async function (next) {
    if (!this.isModified('contraseña')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.contraseña = await bcrypt.hash(this.contraseña, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar contraseñas
UsuarioSchema.methods.comparePassword = async function (
    candidatePassword: string,
): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.contraseña);
};
