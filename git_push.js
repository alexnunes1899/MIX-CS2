import { execSync } from 'child_process';

try {
  console.log('Staging files...');
  execSync('git add -A', { stdio: 'inherit' });

  console.log('Committing...');
  execSync('git commit -m "feat: auto faceit level sync, chat sender name, room privacy/invite links, and MD1/MD3/MD5 map series"', { stdio: 'inherit' });

  console.log('Pushing to origin main...');
  execSync('git push origin main', { stdio: 'inherit' });

  console.log('Push complete!');
} catch (err) {
  console.error('Error during git push:', err);
  process.exit(1);
}
