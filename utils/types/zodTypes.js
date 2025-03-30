import { z } from "zod";

export const signUpSchema = z.object({
    firstName: z.string().min(1, {message: "Please fill in this field"}).max(20, {message: "Only 20 charaters are allowed"}),
    lastName: z.string().min(1, {message: "Please fill in this field"}).max(20, {message: "Only 20 charaters are allowed"}),
    email: z.string().min(1, {message: "Please fill in this field"}).email("This is not a valid email"),
    phone: z.string().min(10, { message: "Must be at least 10 digits" }).max(14, { message: "Must be at most 14 digits" }).regex(/^\d+$/, { message: "Phone number must contain only digits" }),

    city: z.string().min(1, {message: "Please fill in this field"}).max(40, {message: "Only 85 charaters are allowed"}),
    password: z.string().min(8),}).superRefine(({ password }, checkPassComplexity) => {
        const containsUppercase = (ch) => /[A-Z]/.test(ch);
        const containsLowercase = (ch) => /[a-z]/.test(ch);
        const containsSpecialChar = (ch) =>
            /[`!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?~ ]/.test(ch);
        let countOfUpperCase = 0,
            countOfLowerCase = 0,
            countOfNumbers = 0,
            countOfSpecialChar = 0;
        for (let i = 0; i < password.length; i++) {
            let ch = password.charAt(i);
            if (!isNaN(+ch)) countOfNumbers++;
            else if (containsUppercase(ch)) countOfUpperCase++;
            else if (containsLowercase(ch)) countOfLowerCase++;
            else if (containsSpecialChar(ch)) countOfSpecialChar++;
        }
        if (
            countOfLowerCase < 1 ||
            countOfUpperCase < 1 ||
            countOfSpecialChar < 1 ||
            countOfNumbers < 1
        ) {
            checkPassComplexity.addIssue({
            code: "custom",
            message: "Password must include at least one uppercase, one lowercase, one number, and one special character",
            });
        }
});


export const signInSchema = z.object({
    email: z.string().min(1, {message: "Please fill in this field"}).email("This is not a valid email"),
    password: z.string().min(3, {message: "Enter a valid message"}).max(40, {message: "Enter a valid message"})
})