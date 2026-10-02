ALTER TABLE public.profiles
  ADD COLUMN user_type text,
  ADD COLUMN phone_number text,
  ADD COLUMN student_roll_number text,
  ADD COLUMN employee_staff_id text,
  ADD COLUMN department text,
  ADD COLUMN semester smallint,
  ADD COLUMN academic_year text,
  ADD COLUMN subjects text[],
  ADD COLUMN staff_room_location text,
  ADD COLUMN cleaning_area text,
  ADD COLUMN equipment_room_location text,
  ADD COLUMN break_room_location text,
  ADD COLUMN job_role text,
  ADD COLUMN work_location text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT profiles_user_type_check
    CHECK (user_type IS NULL OR user_type IN ('student', 'teacher', 'cleaner', 'other_staff')),
  ADD CONSTRAINT profiles_semester_check
    CHECK (semester IS NULL OR semester BETWEEN 1 AND 8),
  ADD CONSTRAINT profiles_academic_year_check
    CHECK (academic_year IS NULL OR academic_year IN ('1st Year', '2nd Year', '3rd Year', '4th Year')),
  ADD CONSTRAINT profiles_phone_number_check
    CHECK (phone_number IS NULL OR char_length(trim(phone_number)) BETWEEN 7 AND 30),
  ADD CONSTRAINT profiles_role_details_check CHECK (
    user_type IS NULL
    OR CASE user_type
      WHEN 'student' THEN
        student_roll_number IS NOT NULL AND department IS NOT NULL
        AND semester IS NOT NULL AND academic_year IS NOT NULL
        AND phone_number IS NOT NULL
      WHEN 'teacher' THEN
        employee_staff_id IS NOT NULL AND department IS NOT NULL
        AND subjects IS NOT NULL AND cardinality(subjects) > 0
        AND staff_room_location IS NOT NULL AND phone_number IS NOT NULL
      WHEN 'cleaner' THEN
        employee_staff_id IS NOT NULL AND cleaning_area IS NOT NULL
        AND equipment_room_location IS NOT NULL AND break_room_location IS NOT NULL
        AND phone_number IS NOT NULL
      WHEN 'other_staff' THEN
        employee_staff_id IS NOT NULL AND department IS NOT NULL
        AND job_role IS NOT NULL AND work_location IS NOT NULL
        AND phone_number IS NOT NULL
      ELSE false
    END
  );

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

CREATE UNIQUE INDEX profiles_student_roll_number_uidx
  ON public.profiles (lower(student_roll_number))
  WHERE student_roll_number IS NOT NULL;
CREATE UNIQUE INDEX profiles_employee_staff_id_uidx
  ON public.profiles (lower(employee_staff_id))
  WHERE employee_staff_id IS NOT NULL;
CREATE INDEX profiles_user_type_idx ON public.profiles (user_type) WHERE user_type IS NOT NULL;

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Campus staff read claimant profiles" ON public.profiles;
CREATE POLICY "Campus staff read claimant profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.is_campus_staff()
    AND EXISTS (
      SELECT 1 FROM public.claims AS c
      WHERE c.claimant_id = profiles.id
    )
  );

CREATE OR REPLACE FUNCTION public.save_user_profile(p_profile jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_type text;
  v_role public.campus_role;
  v_full_name text;
  v_phone text;
  v_department text;
  v_student_roll text;
  v_employee_id text;
  v_semester smallint;
  v_academic_year text;
  v_subjects text[];
  v_staff_room text;
  v_cleaning_area text;
  v_equipment_room text;
  v_break_room text;
  v_job_role text;
  v_work_location text;
BEGIN
  IF v_user_id IS NULL OR jsonb_typeof(p_profile) <> 'object' THEN
    RAISE EXCEPTION 'Sign in and provide a complete profile';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'A verified account email is required';
  END IF;

  v_type := p_profile->>'user_type';
  v_full_name := NULLIF(trim(p_profile->>'full_name'), '');
  v_phone := NULLIF(trim(p_profile->>'phone_number'), '');
  v_department := NULLIF(trim(p_profile->>'department'), '');
  v_student_roll := NULLIF(trim(p_profile->>'student_roll_number'), '');
  v_employee_id := NULLIF(trim(p_profile->>'employee_staff_id'), '');
  v_staff_room := NULLIF(trim(p_profile->>'staff_room_location'), '');
  v_cleaning_area := NULLIF(trim(p_profile->>'cleaning_area'), '');
  v_equipment_room := NULLIF(trim(p_profile->>'equipment_room_location'), '');
  v_break_room := NULLIF(trim(p_profile->>'break_room_location'), '');
  v_job_role := NULLIF(trim(p_profile->>'job_role'), '');
  v_work_location := NULLIF(trim(p_profile->>'work_location'), '');

  IF v_full_name IS NULL OR char_length(v_full_name) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Full name must be between 2 and 80 characters';
  END IF;
  IF v_phone IS NULL OR char_length(v_phone) NOT BETWEEN 7 AND 30 THEN
    RAISE EXCEPTION 'Enter a valid mobile or WhatsApp number';
  END IF;

  CASE v_type
    WHEN 'student' THEN
      v_role := 'student';
      IF v_student_roll IS NULL OR v_department IS NULL
        OR (p_profile->>'semester') !~ '^[1-8]$'
        OR p_profile->>'academic_year' NOT IN ('1st Year', '2nd Year', '3rd Year', '4th Year') THEN
        RAISE EXCEPTION 'Complete all required student profile fields';
      END IF;
      v_semester := (p_profile->>'semester')::smallint;
      v_academic_year := p_profile->>'academic_year';
    WHEN 'teacher' THEN
      v_role := 'teacher';
      IF v_employee_id IS NULL OR v_department IS NULL OR v_staff_room IS NULL
        OR jsonb_typeof(p_profile->'subjects') <> 'array' THEN
        RAISE EXCEPTION 'Complete all required teacher profile fields';
      END IF;
      SELECT array_agg(subject) INTO v_subjects
      FROM (
        SELECT DISTINCT trim(entry.value) AS subject
        FROM jsonb_array_elements_text(p_profile->'subjects') AS entry(value)
        WHERE char_length(trim(entry.value)) BETWEEN 1 AND 120
      ) AS cleaned_subjects;
      IF COALESCE(cardinality(v_subjects), 0) = 0 THEN
        RAISE EXCEPTION 'Enter at least one subject taught';
      END IF;
    WHEN 'cleaner' THEN
      v_role := 'cleaning_staff';
      IF v_employee_id IS NULL OR v_cleaning_area IS NULL
        OR v_equipment_room IS NULL OR v_break_room IS NULL THEN
        RAISE EXCEPTION 'Complete all required cleaner profile fields';
      END IF;
    WHEN 'other_staff' THEN
      v_role := 'other_staff';
      IF v_employee_id IS NULL OR v_department IS NULL
        OR v_job_role IS NULL OR v_work_location IS NULL THEN
        RAISE EXCEPTION 'Complete all required staff profile fields';
      END IF;
    ELSE
      RAISE EXCEPTION 'Choose a valid user type';
  END CASE;

  INSERT INTO public.profiles (
    id, full_name, college_email, campus_role, user_type, phone_number,
    student_roll_number, employee_staff_id, department, semester, academic_year,
    subjects, staff_room_location, cleaning_area, equipment_room_location,
    break_room_location, job_role, work_location, updated_at
  ) VALUES (
    v_user_id, trim(v_full_name), v_email, v_role, v_type, v_phone,
    CASE WHEN v_type = 'student' THEN v_student_roll END,
    CASE WHEN v_type <> 'student' THEN v_employee_id END,
    CASE WHEN v_type <> 'cleaner' THEN v_department END,
    v_semester, v_academic_year, v_subjects,
    CASE WHEN v_type = 'teacher' THEN v_staff_room END,
    CASE WHEN v_type = 'cleaner' THEN v_cleaning_area END,
    CASE WHEN v_type = 'cleaner' THEN v_equipment_room END,
    CASE WHEN v_type = 'cleaner' THEN v_break_room END,
    CASE WHEN v_type = 'other_staff' THEN v_job_role END,
    CASE WHEN v_type = 'other_staff' THEN v_work_location END,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    college_email = EXCLUDED.college_email,
    campus_role = EXCLUDED.campus_role,
    user_type = EXCLUDED.user_type,
    phone_number = EXCLUDED.phone_number,
    student_roll_number = EXCLUDED.student_roll_number,
    employee_staff_id = EXCLUDED.employee_staff_id,
    department = EXCLUDED.department,
    semester = EXCLUDED.semester,
    academic_year = EXCLUDED.academic_year,
    subjects = EXCLUDED.subjects,
    staff_room_location = EXCLUDED.staff_room_location,
    cleaning_area = EXCLUDED.cleaning_area,
    equipment_room_location = EXCLUDED.equipment_room_location,
    break_room_location = EXCLUDED.break_room_location,
    job_role = EXCLUDED.job_role,
    work_location = EXCLUDED.work_location,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_user_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_user_profile(jsonb) TO authenticated;