this_applicant = HighlyCuriousDoer(name="Rohan Nuttall",
								   humanist=True,
								   energetic=True,
								   moonshot_thinker=True, 
								   excited_by_hard_problems=True, 
								   inspired_by_xers=True,
								   enrolled_in_grad_school=True,
								   loves_physics=True,
								   easily_disuaded=False)

while X.seeks('great-intern'):
	if isinstance(this_applicant, HighlyCuriousDoer):
		X.schedule_interview(name=this_applicant.name)
		this_applicant.ace_interview()
		X.hire(this_applicant)