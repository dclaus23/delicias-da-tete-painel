import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Entrar — Delícias da Tetê',
};

export default function LoginPage() {
  return <LoginForm />;
}
