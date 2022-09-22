import React, { useState } from "react";

const Users = ({ users, selectUser, me }) => {
  return users.map((user) => {
    if (me && me.id !== user.id) {
      return (
        <div className="user" onClick={() => selectUser(user.id)} key={user.id}>
          <img src={user.image} alt={user.username} />
          {user.online && <i className="fa-solid fa-circle online"></i>}
          <p>
            {user.firstName} {user.lastName}
          </p>
          {user.unread > 0 && <span>{user.unread}</span>}
        </div>
      );
    }
  });
};
export default Users;
