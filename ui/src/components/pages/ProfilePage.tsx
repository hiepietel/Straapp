import { ArrowLeft } from "lucide-react";
import DashboardTemplate from "../templates/DashboardTemplate";
import Avatar from "../atoms/Avatar";
import Spinner from "../atoms/Spinner";
import Notice from "../molecules/Notice";
import StatItem from "../molecules/StatItem";
import CollapsibleSection from "../molecules/CollapsibleSection";
import AthleteStatsPanel from "../organisms/AthleteStatsPanel";
import AthleteZonesPanel from "../organisms/AthleteZonesPanel";
import { useAthleteProfile } from "../../hooks/useAthleteProfile";
import { LIST_HREF } from "../../hooks/useRoute";
import { formatDate, formatDistance } from "../../utils/format";
import type { Section } from "../../hooks/useAthleteProfile";
import type { ReactNode } from "react";

const SEX_LABEL: Record<string, string> = { M: "Male", F: "Female" };

const backLink = (
  <a
    href={LIST_HREF}
    className="inline-flex items-center gap-1 text-sm font-semibold text-mute hover:text-ink hover:underline"
  >
    <ArrowLeft className="size-4" aria-hidden="true" />
    All activities
  </a>
);

/** A section that loads on its own — shown as a spinner, an error with retry, or its content. */
function SectionBody<T>({
  section,
  onRetry,
  children,
}: {
  section: Section<T>;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  if (section.status === "loading") {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Loading" />
      </div>
    );
  }
  if (section.status === "error" || !section.data) {
    return (
      <Notice tone="error" actionLabel="Try again" onAction={onRetry}>
        {section.error}
      </Notice>
    );
  }
  return <>{children(section.data)}</>;
}

export default function ProfilePage() {
  const { athlete, stats, zones, retry } = useAthleteProfile();

  if (athlete.status === "loading") {
    return (
      <DashboardTemplate header={<div className="pt-10">{backLink}</div>}>
        <div className="flex justify-center py-24">
          <Spinner label="Loading your profile" />
        </div>
      </DashboardTemplate>
    );
  }

  if (athlete.status === "error" || !athlete.data) {
    return (
      <DashboardTemplate
        header={<div className="pt-10">{backLink}</div>}
        notice={
          <Notice tone="error" actionLabel="Try again" onAction={retry}>
            {athlete.error}
          </Notice>
        }
      />
    );
  }

  const a = athlete.data;
  const name = `${a.firstname} ${a.lastname}`;
  const location = [a.city, a.state, a.country].filter(Boolean).join(", ");
  const hasGear = !!a.bikes?.length || !!a.shoes?.length;

  return (
    <DashboardTemplate
      header={
        <header className="pt-10 pb-2">
          {backLink}
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <Avatar src={a.profile ?? a.profile_medium} name={name} className="size-20 text-2xl" />
            <div>
              <h1 className="num text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">
                {name}
              </h1>
              {location && <p className="mt-2 text-mute">{location}</p>}
            </div>
          </div>
        </header>
      }
      summary={
        <section aria-label="Athlete facts" className="border-y border-line py-5">
          <dl className="flex flex-wrap gap-x-12 gap-y-4">
            {a.created_at && (
              <StatItem label="Member since" value={formatDate(a.created_at).replace(/^\w+, /, "")} />
            )}
            {a.follower_count !== undefined && (
              <StatItem label="Followers" value={a.follower_count} />
            )}
            {a.friend_count !== undefined && <StatItem label="Following" value={a.friend_count} />}
            {a.weight !== undefined && <StatItem label="Weight" value={`${a.weight} kg`} />}
            {!!a.ftp && <StatItem label="FTP" value={`${a.ftp} W`} />}
            {a.sex && <StatItem label="Sex" value={SEX_LABEL[a.sex] ?? a.sex} />}
            {(a.premium || a.summit) && (
              <StatItem label="Plan" value={a.summit ? "Summit" : "Premium"} />
            )}
          </dl>
        </section>
      }
    >
      <div className="space-y-10">
        {hasGear && (
          <CollapsibleSection title="Gear">
            <div className="grid gap-6 sm:grid-cols-2">
              {!!a.bikes?.length && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-mute">Bikes</h3>
                  <ul className="space-y-1.5">
                    {a.bikes.map((bike) => (
                      <li key={bike.id} className="flex items-baseline justify-between gap-4 text-sm">
                        <span>{bike.name}</span>
                        <span className="num shrink-0 text-mute">{formatDistance(bike.distance)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!a.shoes?.length && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-mute">Shoes</h3>
                  <ul className="space-y-1.5">
                    {a.shoes.map((shoe) => (
                      <li key={shoe.id} className="flex items-baseline justify-between gap-4 text-sm">
                        <span>{shoe.name}</span>
                        <span className="num shrink-0 text-mute">{formatDistance(shoe.distance)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Stats">
          <SectionBody section={stats} onRetry={retry}>
            {(data) => <AthleteStatsPanel stats={data} />}
          </SectionBody>
        </CollapsibleSection>

        <CollapsibleSection title="Training zones">
          <SectionBody section={zones} onRetry={retry}>
            {(data) => <AthleteZonesPanel zones={data} />}
          </SectionBody>
        </CollapsibleSection>
      </div>
    </DashboardTemplate>
  );
}
