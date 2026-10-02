import {supabaseConfig} from '../../server/supabase/config';
import {AppError} from '../../application/models';
import {AccessState,Header} from '../../components/access';
import {LoginForm} from '../../components/forms';
export const dynamic='force-dynamic';
export default function Login(){return <main><Header/>{!supabaseConfig()?<AccessState error={new AppError('CONFIGURATION')}/>:<section className="panel narrow"><p className="eyebrow">PRIVATE ACCESS</p><h1>ログイン</h1><p>管理者が作成した既存アカウントでログインしてください。この画面から新規登録やメール送信は行いません。</p><LoginForm/></section>}</main>;}
