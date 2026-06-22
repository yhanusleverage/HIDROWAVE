import { redirect } from 'next/navigation';

/** Rota legada — redireciona para Informação */
export default function AjudaRedirectPage() {
  redirect('/informacao');
}
