// Initialize Tau Prolog session
const session = pl.create();

// Define the Prolog program with extended rules
const program = `
    % Dynamic predicates for student data
    :- dynamic student/4.
    :- dynamic processed_count/1.
    
    % Initialize processed count
    processed_count(0).
    
    % Rule for scholarship eligibility
    eligible_for_scholarship(StudentId) :-
        student(StudentId, Attendance, CGPA, _),
        Attendance >= 75,
        CGPA >= 9.0.
    
    % Rule for exam permission
    permitted_for_exam(StudentId) :-
        student(StudentId, Attendance, _, _),
        Attendance >= 75.
    
    % Rule for attendance warning
    attendance_warning(StudentId) :-
        student(StudentId, Attendance, _, _),
        Attendance < 75,
        Attendance >= 65.
    
    % Rule for critical attendance
    critical_attendance(StudentId) :-
        student(StudentId, Attendance, _, _),
        Attendance < 65.
    
    % Rule to get all eligible students for scholarship
    get_all_eligible_scholarship(Students) :-
        findall(StudentId, eligible_for_scholarship(StudentId), Students).
    
    % Rule to get all permitted students for exam
    get_all_permitted_exam(Students) :-
        findall(StudentId, permitted_for_exam(StudentId), Students).
    
    % Rule to increment processed count
    increment_processed :-
        retract(processed_count(Count)),
        NewCount is Count + 1,
        assert(processed_count(NewCount)).
`;

// Load the program
session.consult(program);

// Function to assert student data
function assertStudent(id, attendance, cgpa, batch) {
    const query = `assertz(student('${id}', ${attendance}, ${cgpa}, '${batch}'))`;
    session.query(query);
    session.answer();
}

// Function to check single student eligibility
function checkEligibility(id) {
    return new Promise((resolve, reject) => {
        const result = {
            scholarship: false,
            exam: false,
            warning: false,
            critical: false
        };

        // Check scholarship eligibility
        session.query(`eligible_for_scholarship('${id}')`);
        result.scholarship = session.answer();

        // Check exam permission
        session.query(`permitted_for_exam('${id}')`);
        result.exam = session.answer();

        // Check attendance warning
        session.query(`attendance_warning('${id}')`);
        result.warning = session.answer();

        // Check critical attendance
        session.query(`critical_attendance('${id}')`);
        result.critical = session.answer();

        resolve(result);
    });
}

// Function to get all processed students
function getAllStudents() {
    return new Promise((resolve, reject) => {
        session.query('findall([ID, A, C, B], student(ID, A, C, B), Students)');
        session.answer(answer => {
            if (pl.type.is_substitution(answer)) {
                const students = answer.lookup('Students');
                resolve(students.toJavaScript());
            } else {
                resolve([]);
            }
        });
    });
}