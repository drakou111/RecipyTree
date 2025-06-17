import "./Toggle.css";

export const Toggle = ({ handleChange, isChecked }) => {
    return (
        <div className="toggle-container">
            <input
                type="checkbox"
                id="theme-toggle"
                className="toggle"
                onChange={handleChange}
                checked={isChecked}
            />
            <label htmlFor="theme-toggle" className="toggle-label">
                <span className="toggle-switch"></span>
                <span className="toggle-text">Dark Mode</span>
            </label>
        </div>
    );
};