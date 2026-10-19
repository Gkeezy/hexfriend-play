import * as ghpages from 'gh-pages';

ghpages.publish(
	'dist',
	{
		branch: 'gh-pages',
		repo: 'https://github.com/Gkeezy/hexfriend-play.git',
		user: {
			name: 'Gkeezy',
			email: 'gkeezy@users.noreply.github.com',
		},
		message: 'Deploy Hexfriend-Play',
	},
	(err) => {
		if (err) {
			console.error(err);
			process.exit(1);
		} else {
			console.log('Deploy Complete!');
		}
	}
);
