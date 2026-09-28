import DashboardTemplate from "../templates/DashboardTemplate";
import Button from "../atoms/Button";
import Spinner from "../atoms/Spinner";
import Notice from "../molecules/Notice";

export interface LoginPageProps {
  onLogin: () => void;
  error?: string | null | undefined;
  /** Coming back from Strava and finishing the login. */
  busy?: boolean;
}

export default function LoginPage({ onLogin, error = null, busy = false }: LoginPageProps) {
  return (
    <DashboardTemplate
      header={
        <header className="pt-10 pb-2">
          <h1 className="num text-5xl leading-none font-extrabold tracking-tight sm:text-6xl">
            My activities
          </h1>
          <p className="mt-3 text-mute">Log in with Strava to see your own activities.</p>
        </header>
      }
      notice={error && <Notice tone="error">{error}</Notice>}
    >
      <div className="flex justify-center py-16">
        {busy ? (
          <Spinner label="Signing you in" />
        ) : (
          <Button onClick={onLogin}>Log in with Strava</Button>
        )}
      </div>
    </DashboardTemplate>
  );
}
