import {
  Component,
  OnInit,
  inject,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { SupabaseService } from '../services/supabase';
import { Client } from '../models/client.model';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonItemSliding,
  IonItemOptions, IonItemOption, IonIcon, IonButton,
  IonInput, IonCard, IonCardContent, IonCardHeader,
  IonCardTitle, IonToast
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { createOutline, trashOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonLabel, IonItemSliding,
    IonItemOptions, IonItemOption, IonIcon, IonButton,
    IonInput, IonCard, IonCardContent, IonCardHeader,
    IonCardTitle, IonToast, RouterLink
  ]
})
export class HomePage implements OnInit {
  private supabaseService = inject(SupabaseService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  currentUser = this.supabaseService.currentUser;
  isAdmin = this.supabaseService.userRole;

  modo: 'inicio' | 'login' | 'lectura' | 'admin' = 'inicio';

  isLoggingIn = false;
  isChangingMode = false;
  isSaving = false;

  clients: Client[] = [];
  clientForm: FormGroup;
  editingClientId: string | null = null;

  toastMessage = '';
  isToastOpen = false;

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  get puedeModificar(): boolean {
    return this.modo === 'admin' && this.isAdmin() === 'admin';
  }

  constructor() {
    addIcons({ createOutline, trashOutline });

    this.clientForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      ciudad: ['', Validators.required],
      fecha_alta: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.modo = 'inicio';
  }

  // ACCESO A LA APLICACIÓN

  abrirLogin(): void {
    this.loginForm.reset();
    this.modo = 'login';
  }

  async entrarSoloLectura(): Promise<void> {
    if (this.isChangingMode || this.isSaving) return;

    this.isChangingMode = true;

    try {
      await this.supabaseService.logout();

      this.clients = [];
      this.resetForm();
      this.modo = 'lectura';

      await this.loadClients();
    } catch (error: unknown) {
      this.showToast(this.obtenerMensajeError(error));
    } finally {
      this.isChangingMode = false;
      this.cdr.markForCheck();
    }
  }

  async iniciarSesion(): Promise<void> {
    if (this.loginForm.invalid || this.isLoggingIn) return;

    this.isLoggingIn = true;

    const { email, password } = this.loginForm.getRawValue();

    try {
      await this.supabaseService.login(email, password);

      if (this.isAdmin() !== 'admin') {
        await this.supabaseService.logout();

        this.showToast(
          'Esta cuenta no tiene permisos de administrador'
        );
        return;
      }

      this.modo = 'admin';
      this.loginForm.reset();

      await this.loadClients();

      this.showToast('Sesión iniciada como administrador');
    } catch (error: unknown) {
      this.showToast(this.obtenerMensajeError(error));
    } finally {
      this.isLoggingIn = false;
      this.cdr.markForCheck();
    }
  }

  async volverInicio(): Promise<void> {
    if (
      this.isChangingMode ||
      this.isLoggingIn ||
      this.isSaving
    ) {
      return;
    }

    this.isChangingMode = true;

    try {
      await this.supabaseService.logout();

      this.clients = [];
      this.resetForm();
      this.loginForm.reset();
      this.modo = 'inicio';
    } catch (error: unknown) {
      this.showToast(this.obtenerMensajeError(error));
    } finally {
      this.isChangingMode = false;
      this.cdr.markForCheck();
    }
  }

  // GESTIÓN DE CLIENTES

  async loadClients(): Promise<void> {
    try {
      this.clients = await this.supabaseService.getClient();
    } catch (error: unknown) {
      this.showToast(
        'Error cargando clientes: ' +
        this.obtenerMensajeError(error)
      );
    } finally {
      this.cdr.markForCheck();
    }
  }

  async saveClient(): Promise<void> {
    if (this.isSaving) return;

    if (!this.puedeModificar) {
      this.showToast(
        'Necesitas iniciar sesión como administrador'
      );
      return;
    }

    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;

    const id = this.editingClientId;
    const datos = this.clientForm.getRawValue();

    try {
      if (id !== null) {
        await this.supabaseService.updateClient(id, datos);
        this.showToast('Cliente actualizado');
      } else {
        await this.supabaseService.createClient(datos);
        this.showToast('Cliente insertado');
      }

      this.resetForm();
      await this.loadClients();
    } catch (error: unknown) {
      this.showToast(
        'Error guardando cliente: ' +
        this.obtenerMensajeError(error)
      );
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  editClient(client: Client): void {
    if (this.isSaving) return;

    if (!this.puedeModificar) {
      this.showToast(
        'Necesitas iniciar sesión como administrador'
      );
      return;
    }

    if (!client.id) return;

    this.editingClientId = client.id;

    this.clientForm.patchValue({
      nombre: client.nombre,
      ciudad: client.ciudad,
      fecha_alta: client.fecha_alta
    });
  }

  async deleteClient(id: string): Promise<void> {
    if (this.isSaving) return;

    if (!this.puedeModificar) {
      this.showToast(
        'Necesitas iniciar sesión como administrador'
      );
      return;
    }

    try {
      await this.supabaseService.deleteClient(id);

      if (this.editingClientId === id) {
        this.resetForm();
      }

      this.showToast('Cliente eliminado');
      await this.loadClients();
    } catch (error: unknown) {
      this.showToast(
        'Error eliminando cliente: ' +
        this.obtenerMensajeError(error)
      );
    } finally {
      this.cdr.markForCheck();
    }
  }

  resetForm(): void {
    this.clientForm.reset();
    this.editingClientId = null;
  }

  // MENSAJES

  setToastOpen(isOpen: boolean): void {
    this.isToastOpen = isOpen;
    this.cdr.markForCheck();
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    this.isToastOpen = true;
    this.cdr.markForCheck();
  }

  private obtenerMensajeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error
    ) {
      return String(error.message);
    }

    return 'Ha ocurrido un error inesperado';
  }
}