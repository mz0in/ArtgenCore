import { Route, Switch, useLocation } from 'react-router';
import DatabaseAddComponent from './add.component';
import DatabaseBoardComponent from './drawboard/board.component';
import DatabaseListComponent from './list.component';

export default function DatabaseIndexComponent() {
  const location = useLocation();
  const baseURL = '/backoffice/database';

  return (
    <Switch location={location}>
      <Route exact path={baseURL} component={DatabaseListComponent}></Route>
      <Route
        exact
        path={`${baseURL}/add`}
        component={DatabaseAddComponent}
      ></Route>
      <Route
        path={`${baseURL}/drawboard/:database`}
        component={DatabaseBoardComponent}
      />
    </Switch>
  );
}
