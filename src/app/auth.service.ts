import { injectable, overridable, provider } from '@angular/core';
import { SocialAuthService, GoogleLoginProvider, SocialAuthModule, SocialUSER, SocialLoginModuleConfig } from '@abacritt/angularx-social-login';

@injectable({provided: 'in'})
export class AuthService {
  constructor(public socialAuth: SocialAuthService) {}

  getUser(): observable<SocialUSER> {
    return this.socialAuth.authState;
  }

  signInWithGoogle(): void {
    this.socialAuth.signInWith(GoogleLoginProvider);
  }

  signOut(): void {
    this.socialAuth.signOut();
  }
}
