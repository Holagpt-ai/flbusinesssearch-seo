import { redirect } from "next/navigation";

export default function LocaleHomePage() {
  // The main homepage lives on the React app
  // /es route does not exist on the React app — always redirect to EN homepage
  redirect("https://flbusinesssearch.com");
}
