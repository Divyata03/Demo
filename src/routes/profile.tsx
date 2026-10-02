import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchMyItems,
  fetchProfile,
  PROFILE_TYPE_LABEL,
  saveUserProfile,
  type ProfileSaveInput,
  type ProfileUserType,
} from "@/lib/items";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My Profile — CampusFind" }] }),
  component: ProfilePage,
});

type ProfileRow = NonNullable<Awaited<ReturnType<typeof fetchProfile>>>;
type ProfileForm = {
  user_type: ProfileUserType | "";
  full_name: string;
  phone_number: string;
  student_roll_number: string;
  employee_staff_id: string;
  department: string;
  department_other: string;
  semester: string;
  academic_year: string;
  subjects: string;
  staff_room_location: string;
  cleaning_area: string;
  cleaning_area_other: string;
  equipment_room_location: string;
  break_room_location: string;
  job_role: string;
  work_location: string;
};

const DEPARTMENTS = [
  "Computer Department",
  "Mechanical Department",
  "Civil Department",
  "Electrical Department",
  "Chemical Department",
  "Architecture Department",
  "Other",
];
const CLEANING_AREAS = [...DEPARTMENTS.slice(0, -1), "Common Areas", "Other"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const fieldClass =
  "w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-ink";
const labelClass = "mb-2 block text-sm font-semibold";

function isProfileUserType(value: unknown): value is ProfileUserType {
  return (
    value === "student" || value === "teacher" || value === "cleaner" || value === "other_staff"
  );
}

function blankProfile(userType: ProfileUserType | "" = "", fullName = ""): ProfileForm {
  return {
    user_type: userType,
    full_name: fullName,
    phone_number: "",
    student_roll_number: "",
    employee_staff_id: "",
    department: "",
    department_other: "",
    semester: "",
    academic_year: "",
    subjects: "",
    staff_room_location: "",
    cleaning_area: "",
    cleaning_area_other: "",
    equipment_room_location: "",
    break_room_location: "",
    job_role: "",
    work_location: "",
  };
}

function profileToForm(
  profile: ProfileRow | null,
  fallbackType: ProfileUserType | "",
  fallbackName: string,
): ProfileForm {
  const form = blankProfile(
    isProfileUserType(profile?.user_type) ? profile.user_type : fallbackType,
    profile?.full_name || fallbackName,
  );
  if (!profile) return form;
  const department = profile.department ?? "";
  const cleaningArea = profile.cleaning_area ?? "";
  return {
    ...form,
    phone_number: profile.phone_number ?? "",
    student_roll_number: profile.student_roll_number ?? "",
    employee_staff_id: profile.employee_staff_id ?? "",
    department: DEPARTMENTS.includes(department) ? department : department ? "Other" : "",
    department_other: department && !DEPARTMENTS.includes(department) ? department : "",
    semester: profile.semester?.toString() ?? "",
    academic_year: profile.academic_year ?? "",
    subjects: profile.subjects?.join("\n") ?? "",
    staff_room_location: profile.staff_room_location ?? "",
    cleaning_area: CLEANING_AREAS.includes(cleaningArea)
      ? cleaningArea
      : cleaningArea
        ? "Other"
        : "",
    cleaning_area_other: cleaningArea && !CLEANING_AREAS.includes(cleaningArea) ? cleaningArea : "",
    equipment_room_location: profile.equipment_room_location ?? "",
    break_room_location: profile.break_room_location ?? "",
    job_role: profile.job_role ?? "",
    work_location: profile.work_location ?? "",
  };
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => blankProfile());
  const [hydratedUser, setHydratedUser] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });
  const reportsQuery = useQuery({
    queryKey: ["my-items", user?.id],
    queryFn: fetchMyItems,
    enabled: !!user,
  });
  const profile = profileQuery.data;
  const reports = reportsQuery.data ?? [];
  const returnedCount = reports.filter((item) => item.itemStatus === "returned").length;

  useEffect(() => {
    if (!user || !profileQuery.isSuccess || hydratedUser === user.id) return;
    const metadataType = user.user_metadata?.user_type;
    const fallbackType = isProfileUserType(metadataType) ? metadataType : "";
    const metadataName =
      typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
    setForm(profileToForm(profile ?? null, fallbackType, metadataName));
    setHydratedUser(user.id);
  }, [user, profileQuery.data, profileQuery.isSuccess, hydratedUser, profile]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (!form.user_type) throw new Error("Choose your user type to continue.");
      const department = form.department === "Other" ? form.department_other : form.department;
      const input: ProfileSaveInput = {
        user_type: form.user_type,
        full_name: form.full_name.trim(),
        phone_number: form.phone_number.trim(),
      };
      if (form.user_type === "student") {
        Object.assign(input, {
          student_roll_number: form.student_roll_number.trim(),
          department,
          semester: form.semester,
          academic_year: form.academic_year,
        });
      } else if (form.user_type === "teacher") {
        Object.assign(input, {
          employee_staff_id: form.employee_staff_id.trim(),
          department,
          subjects: form.subjects
            .split(/[\n,]/)
            .map((subject) => subject.trim())
            .filter(Boolean),
          staff_room_location: form.staff_room_location.trim(),
        });
      } else if (form.user_type === "cleaner") {
        Object.assign(input, {
          employee_staff_id: form.employee_staff_id.trim(),
          cleaning_area:
            form.cleaning_area === "Other" ? form.cleaning_area_other.trim() : form.cleaning_area,
          equipment_room_location: form.equipment_room_location.trim(),
          break_room_location: form.break_room_location.trim(),
        });
      } else {
        Object.assign(input, {
          employee_staff_id: form.employee_staff_id.trim(),
          department,
          job_role: form.job_role.trim(),
          work_location: form.work_location.trim(),
        });
      }
      await saveUserProfile(input);
      await profileQuery.refetch();
      setNotice("Your profile has been saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <div className="px-5 py-24 text-center text-ink/60">Loading your profile…</div>;
  if (!user) return <SignInPrompt next="/profile" action="view your profile" />;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-mustard/30 px-4 py-1.5 text-sm font-medium text-ink">
        Your account
      </span>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        {profile?.user_type ? "My Profile" : "Complete your profile"}
      </h1>
      {profileQuery.isLoading ? (
        <p className="mt-8 text-center text-ink/60">Loading profile…</p>
      ) : profileQuery.isError ? (
        <p
          role="alert"
          className="mt-8 rounded-3xl bg-tomato/12 p-6 text-center font-medium text-tomato"
        >
          We couldn't load your profile.
        </p>
      ) : (
        <>
          {profile?.user_type == null && (
            <p className="mt-5 rounded-2xl bg-mustard/30 p-4 text-sm">
              Add your campus details to complete your profile. Your contact information and IDs are
              private and are not shown on public item listings.
            </p>
          )}
          <section className="mt-8 border-b-2 border-ink/10 pb-6">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-ink/55">Reports</dt>
                <dd className="mt-1">{reportsQuery.isLoading ? "Loading…" : reports.length}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink/55">Returned items</dt>
                <dd className="mt-1">{reportsQuery.isLoading ? "Loading…" : returnedCount}</dd>
              </div>
            </dl>
          </section>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
            <div>
              <label htmlFor="profile-user-type" className={labelClass}>
                User Type
              </label>
              <select
                id="profile-user-type"
                required
                value={form.user_type}
                onChange={(event) =>
                  update("user_type", event.target.value as ProfileForm["user_type"])
                }
                className={fieldClass}
              >
                <option value="">Select your user type</option>
                {(Object.keys(PROFILE_TYPE_LABEL) as ProfileUserType[]).map((type) => (
                  <option key={type} value={type}>
                    {PROFILE_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </div>
            {form.user_type && (
              <>
                <div>
                  <label htmlFor="profile-full-name" className={labelClass}>
                    Full Name
                  </label>
                  <input
                    id="profile-full-name"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    value={form.full_name}
                    onChange={(event) => update("full_name", event.target.value)}
                    className={fieldClass}
                  />
                </div>
                {form.user_type === "student" ? (
                  <>
                    <div>
                      <label htmlFor="student-roll" className={labelClass}>
                        College Roll Number
                      </label>
                      <input
                        id="student-roll"
                        required
                        maxLength={80}
                        value={form.student_roll_number}
                        onChange={(event) => update("student_roll_number", event.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <DepartmentField form={form} update={update} />
                    <div>
                      <label htmlFor="student-semester" className={labelClass}>
                        Semester
                      </label>
                      <select
                        id="student-semester"
                        required
                        value={form.semester}
                        onChange={(event) => update("semester", event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select semester</option>
                        {Array.from({ length: 8 }, (_, index) => String(index + 1)).map(
                          (semester) => (
                            <option key={semester} value={semester}>
                              {semester}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="academic-year" className={labelClass}>
                        Academic Year
                      </label>
                      <select
                        id="academic-year"
                        required
                        value={form.academic_year}
                        onChange={(event) => update("academic_year", event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select academic year</option>
                        {YEARS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : form.user_type === "teacher" ? (
                  <>
                    <EmployeeIdField form={form} update={update} />
                    <DepartmentField form={form} update={update} />
                    <div>
                      <label htmlFor="teacher-subjects" className={labelClass}>
                        Subject(s) Taught
                      </label>
                      <textarea
                        id="teacher-subjects"
                        required
                        rows={3}
                        maxLength={1000}
                        value={form.subjects}
                        onChange={(event) => update("subjects", event.target.value)}
                        placeholder="One subject per line"
                        className={fieldClass}
                      />
                    </div>
                    <TextField
                      id="staff-room"
                      label="Staff Room / Staff Room Location"
                      value={form.staff_room_location}
                      onChange={(value) => update("staff_room_location", value)}
                    />
                  </>
                ) : form.user_type === "cleaner" ? (
                  <>
                    <EmployeeIdField form={form} update={update} />
                    <div>
                      <label htmlFor="cleaning-area" className={labelClass}>
                        Department/Area Responsible For Cleaning
                      </label>
                      <select
                        id="cleaning-area"
                        required
                        value={form.cleaning_area}
                        onChange={(event) => update("cleaning_area", event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select area</option>
                        {CLEANING_AREAS.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>
                      {form.cleaning_area === "Other" && (
                        <input
                          required
                          maxLength={120}
                          aria-label="Other cleaning area"
                          placeholder="Enter area"
                          value={form.cleaning_area_other}
                          onChange={(event) => update("cleaning_area_other", event.target.value)}
                          className={`${fieldClass} mt-3`}
                        />
                      )}
                    </div>
                    <TextField
                      id="equipment-room"
                      label="Equipment Room Location"
                      value={form.equipment_room_location}
                      onChange={(value) => update("equipment_room_location", value)}
                    />
                    <TextField
                      id="break-room"
                      label="Rest Room / Break Room Location"
                      value={form.break_room_location}
                      onChange={(value) => update("break_room_location", value)}
                    />
                  </>
                ) : (
                  <>
                    <EmployeeIdField form={form} update={update} />
                    <DepartmentField form={form} update={update} />
                    <TextField
                      id="job-role"
                      label="Job Role"
                      value={form.job_role}
                      onChange={(value) => update("job_role", value)}
                    />
                    <TextField
                      id="work-location"
                      label="Work Location"
                      value={form.work_location}
                      onChange={(value) => update("work_location", value)}
                    />
                  </>
                )}
                <div>
                  <label htmlFor="profile-phone" className={labelClass}>
                    Mobile/WhatsApp Number
                  </label>
                  <input
                    id="profile-phone"
                    type="tel"
                    required
                    minLength={7}
                    maxLength={30}
                    autoComplete="tel"
                    value={form.phone_number}
                    onChange={(event) => update("phone_number", event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="profile-email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    readOnly
                    value={profile?.college_email ?? user.email ?? ""}
                    className={`${fieldClass} bg-ink/5`}
                  />
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="rounded-2xl bg-tomato/12 p-3 text-sm text-tomato">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-2xl bg-mustard/30 p-3 text-sm text-ink">
                {notice}
              </p>
            )}
            <button
              type="submit"
              disabled={saving || !form.user_type}
              className="w-full rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream disabled:opacity-60 sm:w-auto sm:self-start"
            >
              {saving ? "Saving…" : profile?.user_type ? "Save profile" : "Complete profile"}
            </button>
          </form>
          {reportsQuery.isError && (
            <p role="alert" className="mt-4 text-sm text-tomato">
              Report totals are temporarily unavailable.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        required
        maxLength={160}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </div>
  );
}

function EmployeeIdField({
  form,
  update,
}: {
  form: ProfileForm;
  update: <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;
}) {
  return (
    <div>
      <label htmlFor="employee-id" className={labelClass}>
        Employee/Staff ID
      </label>
      <input
        id="employee-id"
        required
        maxLength={80}
        value={form.employee_staff_id}
        onChange={(event) => update("employee_staff_id", event.target.value)}
        className={fieldClass}
      />
    </div>
  );
}

function DepartmentField({
  form,
  update,
}: {
  form: ProfileForm;
  update: <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;
}) {
  return (
    <div>
      <label htmlFor="profile-department" className={labelClass}>
        Department
      </label>
      <select
        id="profile-department"
        required
        value={form.department}
        onChange={(event) => update("department", event.target.value)}
        className={fieldClass}
      >
        <option value="">Select department</option>
        {DEPARTMENTS.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
      </select>
      {form.department === "Other" && (
        <input
          required
          maxLength={120}
          aria-label="Other department"
          placeholder="Enter department"
          value={form.department_other}
          onChange={(event) => update("department_other", event.target.value)}
          className={`${fieldClass} mt-3`}
        />
      )}
    </div>
  );
}
