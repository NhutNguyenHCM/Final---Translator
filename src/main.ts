import { Component, OnDestroy, NgZone } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  switchMap,
} from 'rxjs/operators';
import { Subject, Subscription, of, Observable } from 'rxjs';
import { importProvidersFrom } from '@angular/core';

interface TranscriptItem {
  original: string;
  translated: string;
  isFinal: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="container">
      <h1>Angular Translator</h1>
      <div class="card">
        <div class="input-section">
          <textarea
            [(ngModel)]="inputText"
            (ngModelChange)="onInputChange()"
            placeholder="Enter text to translate"
            rows="4"
            [disabled]="isListening"
          ></textarea>
          <div class="button-group">
            <button (click)="translateText()" class="primary" [disabled]="isListening">
              <i class="fas fa-language"></i> Translate
            </button>
            <button (click)="toggleSpeechRecognition()" [class.active]="isListening" class="secondary">
              <i class="fas" [ngClass]="isListening ? 'fa-stop' : 'fa-microphone'"></i>
              {{ isListening ? 'Stop' : 'Speech' }}
            </button>
          </div>
        </div>
        <div class="output-section" *ngIf="!isListening && translatedText">
          <h2>Translation:</h2>
          <div class="translation-result">{{ translatedText }}</div>
        </div>
        <div class="output-section" *ngIf="transcript.length > 0">
          <h2>Transcript:</h2>
          <div class="transcript-container">
            <div class="transcript-column">
              <h3>Original</h3>
              <div *ngFor="let item of transcript" class="transcript-item" [class.interim]="!item.isFinal">
                {{ item.original }}
              </div>
            </div>
            <div class="transcript-column">
              <h3>Translated</h3>
              <div *ngFor="let item of transcript" class="transcript-item" [class.interim]="!item.isFinal">
                {{ item.translated }}
              </div>
            </div>
          </div>
        </div>
        <!-- <p *ngIf="isTranslating" class="translating-message">
          <i class="fas fa-spinner fa-spin"></i> Translating...
        </p> -->
        <div *ngIf="error" class="error-message">
          <i class="fas fa-exclamation-circle"></i> {{ error }}
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .transcript-item.interim {
      opacity: 0.7;
      font-style: italic;
    }
  `,
  ],
})
export class App implements OnDestroy {
  inputText = '';
  translatedText = '';
  apiKey = 'AIzaSyDcaX3yqW6g2z1lDBJqDvt8n__82wSGKHA';
  isTranslating = false;
  error: string | null = null;
  isListening = false;
  transcript: TranscriptItem[] = [];

  private inputSubject = new Subject<string>();
  private inputSubscription: Subscription | undefined;
  private recognition: any;

  constructor(private http: HttpClient, private ngZone: NgZone) {
    this.inputSubscription = this.inputSubject
      .pipe(
        debounceTime(10),
        distinctUntilChanged(),
        switchMap((text) => this.translateTextRequest(text))
      )
      .subscribe((translatedText: string) => {
        this.ngZone.run(() => {
          this.translatedText = translatedText;
        });
      });

    this.initSpeechRecognition();
  }

  ngOnDestroy() {
    if (this.inputSubscription) {
      this.inputSubscription.unsubscribe();
    }
    this.stopSpeechRecognition();
  }

  translateText() {
    this.inputSubject.next(this.inputText);
  }

  onInputChange() {
    if (!this.isListening) {
      this.translateText();
    }
  }

  toggleSpeechRecognition() {
    if (this.isListening) {
      this.stopSpeechRecognition();
    } else {
      this.startSpeechRecognition();
    }
  }

  private initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.recognition.lang = 'en-US';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        this.ngZone.run(() => {
          if (finalTranscript) {
            this.translateTextRequest(finalTranscript).subscribe(
              (translatedText: string) => {
                this.transcript.unshift({
                  original: finalTranscript,
                  translated: translatedText,
                  isFinal: true,
                });
              }
            );
          }
          if (interimTranscript) {
            this.translateTextRequest(interimTranscript).subscribe(
              (translatedText: string) => {
                // Update or add the interim result
                const existingInterim = this.transcript.find(
                  (item) => !item.isFinal
                );
                if (existingInterim) {
                  existingInterim.original = interimTranscript;
                  existingInterim.translated = translatedText;
                } else {
                  this.transcript.unshift({
                    original: interimTranscript,
                    translated: translatedText,
                    isFinal: false,
                  });
                }
              }
            );
          }
        });
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        this.ngZone.run(() => {
          this.error = 'Speech recognition failed. Please try again.';
          this.stopSpeechRecognition();
        });
      };
    } else {
      this.error = 'Speech recognition is not supported in this browser.';
    }
  }

  private startSpeechRecognition() {
    if (this.recognition) {
      this.isListening = true;
      this.translatedText = ''; // Clear previous translation
      this.recognition.start();
    }
  }

  private stopSpeechRecognition() {
    if (this.recognition) {
      this.isListening = false;
      this.recognition.stop();
      this.transcript = []; // Clear transcript when stopping
    }
  }

  private translateTextRequest(text: string): Observable<string> {
    if (!text.trim()) {
      return of('');
    }

    this.isTranslating = true;
    this.error = null;
    return this.http.post(this.getApiUrl(), this.getBody(text)).pipe(
      catchError((error) => {
        this.ngZone.run(() => {
          this.isTranslating = false;
          this.error = 'Translation failed. Please try again.';
        });
        console.error('Error:', error);
        return of('Translation error');
      }),
      switchMap((response: any) => {
        this.ngZone.run(() => {
          this.isTranslating = false;
        });
        if (
          response &&
          response.data &&
          response.data.translations &&
          response.data.translations.length > 0
        ) {
          return of(
            this.formatTranslation(response.data.translations[0].translatedText)
          );
        } else {
          return of('No translation available.');
        }
      })
    );
  }

  private getApiUrl() {
    return `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
  }

  private getBody(text: string) {
    return {
      q: text,
      source: 'en',
      target: 'vi',
      format: 'text',
    };
  }

  private formatTranslation(text: string): string {
    return text.trim();
  }
}

bootstrapApplication(App, {
  providers: [provideHttpClient()],
}).catch((err) => console.error(err));
