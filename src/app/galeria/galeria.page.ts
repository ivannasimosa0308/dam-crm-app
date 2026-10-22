import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonSpinner
} from '@ionic/angular';
import { SupabaseService } from '../services/supabase';

@Component({
  selector: 'app-galeria',
  templateUrl: './galeria.page.html',
  styleUrls: ['./galeria.page.scss'],
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonBackButton,
    IonGrid, IonRow, IonCol,
    IonCard, IonCardContent, IonSpinner
  ]
})
export class GaleriaPage implements OnInit {
  private supabaseService = inject(SupabaseService);

  imagenes = signal<{ nombre: string; url: string }[]>([]);
  loading = signal(true);
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const imagenes = await this.supabaseService.getImagenes();
      this.imagenes.set(imagenes);
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar las imágenes'
      );
    } finally {
      this.loading.set(false);
    }
  }
}