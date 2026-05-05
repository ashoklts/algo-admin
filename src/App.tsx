import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import Dropdowns from "./pages/UiElements/Dropdowns";
import ModalsPage from "./pages/UiElements/Modals";
import ProgressBars from "./pages/UiElements/ProgressBars";
import RibbonsPage from "./pages/UiElements/Ribbons";
import SpinnersPage from "./pages/UiElements/Spinners";
import TabsPage from "./pages/UiElements/TabsPage";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import FormLayout from "./pages/Forms/FormLayout";
import Blank from "./pages/Blank";
import Integrations from "./pages/OtherPage/Integrations";
import PricingTables from "./pages/OtherPage/PricingTables";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import Stocks from "./pages/Dashboard/Stocks";
import BacktestStrategy from "./pages/Backtest/Strategy";
import BacktestPortfolios from "./pages/Backtest/Portfolios";
import ForwardTest from "./pages/AlgoTrade/ForwardTest";
import AlgoBacktest from "./pages/AlgoTrade/Backtest";
import PortfolioActivation from "./pages/Common/PortfolioActivation";
import Portfolio from "./pages/Common/Portfolio";
import ExecutionView from "./pages/Common/ExecutionView";
import SimulatorPage from "./pages/Simulator/Simulator";
import SLSimulatorPage from "./pages/Simulator/SLSimulator";
import AnalysePage from "./pages/Common/Analyse";
import OptionSimulatorPage from "./pages/Simulator/OptionSimulator";
import MarginCalculator from "./pages/Backtest/MarginCalculator";
import BarReplay from "./pages/Common/BarReplay";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          <Route element={<AppLayout />}>
            <Route index path="/" element={<Home />} />
            <Route path="/stocks" element={<Stocks />} />
            <Route path="/backtest/strategy" element={<BacktestStrategy />} />
            <Route path="/backtest/portfolios" element={<BacktestPortfolios />} />
            <Route path="/forward-test" element={<ForwardTest />} />
            <Route path="/backtest" element={<AlgoBacktest />} />
            <Route path="/execution/:type/:id" element={<ExecutionView />} />
            <Route path="/portfolio/activation/:portfolioId/:status/:currentDatetime" element={<PortfolioActivation />} />
            <Route path="/portfolio/:portfolioId" element={<Portfolio />} />
            <Route path="/simulator/simulator" element={<SimulatorPage />} />
            <Route path="/simulator/sl-simulator" element={<SLSimulatorPage />} />
            <Route path="/analyse/:entityType/:entityId" element={<AnalysePage />} />
            <Route path="/simulator/option-simulator" element={<OptionSimulatorPage />} />
            <Route path="/backtest/margin-calculator" element={<MarginCalculator />} />
            <Route path="/backtest/bar-replay" element={<BarReplay />} />
            <Route path="/replay/:entityType/:entityId" element={<BarReplay />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/pricing-tables" element={<PricingTables />} />

            {/* Forms */}
            <Route path="/form-elements" element={<FormElements />} />
            <Route path="/form-layout" element={<FormLayout />} />

            {/* Tables */}
            <Route path="/basic-tables" element={<BasicTables />} />

            {/* Ui Elements */}
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/dropdowns" element={<Dropdowns />} />
            <Route path="/modals" element={<ModalsPage />} />
            <Route path="/progress-bars" element={<ProgressBars />} />
            <Route path="/ribbons" element={<RibbonsPage />} />
            <Route path="/spinners" element={<SpinnersPage />} />
            <Route path="/tabs" element={<TabsPage />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />

            {/* Charts */}
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />
          </Route>

          {/* Auth Layout */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
