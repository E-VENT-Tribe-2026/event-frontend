import { useParams } from 'react-router-dom';

/** Stands in for the user profile page so tests can see where the app navigated. */
export default function UserProfileProbe() {
  const { userId } = useParams();
  return <div>User profile page {userId}</div>;
}
