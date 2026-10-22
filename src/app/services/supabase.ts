import { Injectable, signal } from '@angular/core';
import {
    createClient,
    SupabaseClient,
    User
} from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Client } from '../models/client.model';

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    private supabase: SupabaseClient;

    public currentUser = signal<User | null>(null);
    public userRole = signal<'admin' | 'user' | null>(null);

    // Permite esperar a que termine de recuperarse la sesión.
    private sessionReady: Promise<void>;

    constructor() {
        this.supabase = createClient(
            environment.supabaseUrl,
            environment.supabaseKey
        );

        this.sessionReady = this.initSession();
    }

    // AUTENTICACIÓN Y ROLES

    private async initSession(): Promise<void> {
        try {
            const {
                data: { session },
                error
            } = await this.supabase.auth.getSession();

            if (error) throw error;

            if (session?.user) {
                await this.loadRole(session.user.id);
                this.currentUser.set(session.user);
            }
        } catch (error: unknown) {
            this.currentUser.set(null);
            this.userRole.set(null);
            console.error('Error recuperando la sesión:', error);
        }
    }

    async login(email: string, password: string): Promise<void> {
        await this.sessionReady;

        this.userRole.set(null);

        const { data, error } =
            await this.supabase.auth.signInWithPassword({
                email,
                password
            });

        if (error) throw error;

        this.currentUser.set(data.user);

        if (data.user) {
            await this.loadRole(data.user.id);
        }
    }

    async logout(): Promise<void> {
        await this.sessionReady;

        const { error } = await this.supabase.auth.signOut();

        if (error) throw error;

        this.currentUser.set(null);
        this.userRole.set(null);
    }

    private async loadRole(userId: string): Promise<void> {
        this.userRole.set(null);

        const { data, error } = await this.supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (error) throw error;

        if (data.role === 'admin' || data.role === 'user') {
            this.userRole.set(data.role);
        } else {
            throw new Error('El perfil no tiene un rol válido');
        }
    }

    // CRUD DE CLIENTES

    async getClient(): Promise<Client[]> {
        const { data, error } = await this.supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data ?? [];
    }

    async createClient(client: Client): Promise<void> {
        const { error } = await this.supabase
            .from('clients')
            .insert({
                nombre: client.nombre,
                ciudad: client.ciudad,
                fecha_alta: client.fecha_alta
            });

        if (error) throw error;
    }

    async updateClient(
        id: string,
        client: Partial<Client>
    ): Promise<void> {
        const { error } = await this.supabase
            .from('clients')
            .update(client)
            .eq('id', id);

        if (error) throw error;
    }

    async deleteClient(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('clients')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    // IMÁGENES DEL BUCKET PÚBLICO GALERIA

    async getImagenes(): Promise<{ nombre: string; url: string }[]> {
        const bucket = this.supabase.storage.from('galeria');

        const { data, error } = await bucket.list('', {
            limit: 100,
            sortBy: {
                column: 'name',
                order: 'asc'
            }
        });

        if (error) throw error;

        return (data ?? [])
            .filter(archivo =>
                /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(archivo.name)
            )
            .map(archivo => {
                const { data: urlData } =
                    bucket.getPublicUrl(archivo.name);

                return {
                    nombre: archivo.name,
                    url: urlData.publicUrl
                };
            });
    }
}
